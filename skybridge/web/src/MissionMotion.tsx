type RequestState = { id: string; status: string; runId?: string };
type Evidence = { runId?: string; from?: string; to?: string; kind?: string };

export function MissionJourney({request}:{request?:RequestState}) {
  if (!request) return null;
  const labels = ['Requested', 'Coordinating', 'Human review', 'Simulated flight', 'Delivered'];
  const step = request.status === 'delivered' ? 4 : request.status === 'in-flight' ? 3 : request.status === 'awaiting-approval' ? 2 : ['planning','replanning','needs-attention'].includes(request.status) ? 1 : 0;
  const interrupted = ['replanning','needs-attention'].includes(request.status);
  return <div className={`mission-journey ${interrupted?'interrupted':''}`} aria-label="Mission progress"><div className="journey-caption"><span>MISSION PROGRESS</span><span>{interrupted?'Updated conditions require a new decision':request.status==='delivered'?'Simulated delivery complete':'Every stage reflects the shared room state'}</span></div><ol>{labels.map((label,index)=><li key={label} className={index<step?'complete':index===step?'current':'upcoming'} aria-current={index===step?'step':undefined}><span className="journey-mark">{index<step?'✓':String(index+1).padStart(2,'0')}</span><span>{label}</span>{index<labels.length-1&&<i aria-hidden="true"><b style={{transform:`scaleX(${index<step?1:0})`}}/></i>}</li>)}</ol></div>;
}

export function AgentHandoff({runId,audit}:{runId?:string;audit:Evidence[]}) {
  const message=[...audit].reverse().find(entry=>entry.runId===runId&&entry.from&&entry.to);
  const fleetWorking=message?.to==='fleet';
  const supplyWorking=message?.to==='supply';
  return <div className="agent-handoff" role="status"><div className="handoff-heading"><span className="handoff-status-dot"/><span>{fleetWorking?'Fleet is assessing the aircraft':supplyWorking?'Supply is reconciling the findings':'Preparing the coordination request'}</span></div><div className={`handoff-track ${fleetWorking?'to-fleet':supplyWorking?'to-supply':'preparing'}`}><div className={`handoff-agent ${supplyWorking?'working':''}`}><span className="handoff-node">S</span><strong>Supply</strong><small>Inventory + deadline</small></div><div className="handoff-wire" aria-hidden="true"><span/><i/></div><div className={`handoff-agent ${fleetWorking?'working':''}`}><span className="handoff-node">F</span><strong>Fleet</strong><small>Aircraft + constraints</small></div></div><p>Waiting for the current planning run. Approval stays with the dispatcher.</p></div>;
}
