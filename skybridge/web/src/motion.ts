import { useEffect } from 'react';

/** Decorative motion never advances the authoritative delivery simulation. */
export function usePageMotion(paused: boolean): void {
  useEffect(() => {
    const page = document.documentElement;
    const hero = document.querySelector<HTMLElement>('.hero');
    const header = document.querySelector<HTMLElement>('.app-header');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const revealTargets = Array.from(document.querySelectorAll<HTMLElement>(
      '.workspace-intro, .network-panel, .fleet-section, .proposal-panel, .timeline-panel, .coordination-story, .story-steps article',
    ));
    let heroVisible = true;
    let frame = 0;
    let disposed = false;
    let scrolled = false;
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    const canAnimate = () => !disposed && !paused && !reduced.matches && !document.hidden && heroVisible;

    function stopFrame() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }
    function paint() {
      frame = 0;
      if (!hero || !canAnimate()) return;
      current.x += (target.x - current.x) * .1;
      current.y += (target.y - current.y) * .1;
      hero.style.setProperty('--pointer-x', current.x.toFixed(4));
      hero.style.setProperty('--pointer-y', current.y.toFixed(4));
      if (Math.abs(target.x - current.x) + Math.abs(target.y - current.y) > .001) frame = requestAnimationFrame(paint);
    }
    function startFrame() {
      if (!frame && canAnimate()) frame = requestAnimationFrame(paint);
    }
    function pointerMove(event: PointerEvent) {
      if (!hero || !finePointer.matches || event.pointerType !== 'mouse' || !canAnimate()) return;
      const bounds = hero.getBoundingClientRect();
      target.x = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - .5) * 2));
      target.y = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - .5) * 2));
      startFrame();
    }
    function resetPointer() { target.x = 0; target.y = 0; startFrame(); }
    function markVisible(element: HTMLElement) { element.classList.add('is-visible'); }
    function refreshPreference() {
      const inactive = paused || reduced.matches;
      page.classList.toggle('motion-paused', inactive);
      page.classList.toggle('motion-suspended', document.hidden);
      if (inactive) {
        stopFrame();
        revealTargets.forEach(markVisible);
        current.x = current.y = target.x = target.y = 0;
        hero?.style.setProperty('--pointer-x', '0');
        hero?.style.setProperty('--pointer-y', '0');
      } else if (document.hidden) stopFrame();
      else startFrame();
    }
    function scrollState() {
      const next = window.scrollY > 32;
      if (next !== scrolled) { header?.classList.toggle('is-scrolled', next); scrolled = next; }
    }
    function focusReveal(event: FocusEvent) {
      if (!(event.target instanceof HTMLElement)) return;
      event.target.closest<HTMLElement>('.motion-reveal')?.classList.add('is-visible');
    }

    // Content is visible by default. Only offscreen sections enter a one-time reveal.
    for (const element of revealTargets) {
      const bounds = element.getBoundingClientRect();
      if (bounds.top < window.innerHeight * .97 || paused || reduced.matches) markVisible(element);
      element.classList.add('motion-reveal');
    }
    const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        markVisible(entry.target as HTMLElement);
        revealObserver?.unobserve(entry.target);
      }
    }, { threshold: .06, rootMargin: '0px 0px 40px 0px' }) : undefined;
    if (revealObserver) revealTargets.forEach(element => {
      if (!element.classList.contains('is-visible')) revealObserver.observe(element);
    }); else revealTargets.forEach(markVisible);

    const heroObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      heroVisible = entries[0]?.isIntersecting ?? true;
      hero?.classList.toggle('motion-offscreen', !heroVisible);
      if (!heroVisible) stopFrame(); else startFrame();
    }, { threshold: 0 }) : undefined;
    if (hero) heroObserver?.observe(hero);
    page.classList.add('motion-enhanced');
    refreshPreference();
    scrollState();
    hero?.addEventListener('pointermove', pointerMove, { passive: true });
    hero?.addEventListener('pointerleave', resetPointer, { passive: true });
    document.addEventListener('visibilitychange', refreshPreference);
    document.addEventListener('focusin', focusReveal);
    window.addEventListener('scroll', scrollState, { passive: true });
    reduced.addEventListener('change', refreshPreference);
    finePointer.addEventListener('change', resetPointer);
    return () => {
      disposed = true;
      stopFrame();
      revealObserver?.disconnect();
      heroObserver?.disconnect();
      hero?.removeEventListener('pointermove', pointerMove);
      hero?.removeEventListener('pointerleave', resetPointer);
      document.removeEventListener('visibilitychange', refreshPreference);
      document.removeEventListener('focusin', focusReveal);
      window.removeEventListener('scroll', scrollState);
      reduced.removeEventListener('change', refreshPreference);
      finePointer.removeEventListener('change', resetPointer);
      revealTargets.forEach(element => { element.classList.remove('motion-reveal', 'is-visible'); });
      page.classList.remove('motion-enhanced', 'motion-paused', 'motion-suspended');
      hero?.classList.remove('motion-offscreen');
      hero?.style.removeProperty('--pointer-x');
      hero?.style.removeProperty('--pointer-y');
    };
  }, [paused]);
}
