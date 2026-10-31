# SKYBRIDGE visual redesign

Reference: https://www.intel.com/content/www/us/en/homepage.html, visually inspected October 31, 2026. Adapted its deep navy opening, large typography, luminous product-image treatment and clear navigation. SKYBRIDGE retains its own wordmark, copy, content and delivery workflow. No Intel branding or artwork was copied.

The working workspace uses readable type, square controls, blue actions, white surfaces and separators. The existing request, aircraft grounding, exact-plan approval, simulation, role sessions and integration disclosures remain functional.

## Motion

- Composite-only aircraft float and pointer parallax, soft light sweeps and breathing glow in the concept hero.
- Staged heading entrance, one-time scroll reveals, sticky navigation and directional hover feedback.
- An authoritative mission-progress rail and planning handoff visualization. Worker activity is derived from received audit evidence, not fabricated service activity.
- Smooth 650 ms interpolation between authoritative simulated flight positions; route flow runs only while the server simulation is running.
- A Pause visual effects control and full reduced-motion handling. Decorative work suspends when the hero is offscreen or the tab is hidden.

Browser checks confirmed the hero's animation is running, the pause control changes its play state to paused, mission progress follows the room, and an in-flight drone has the expected 650 ms transform transition. The request → grounding → replan → exact approval → simulated delivery fixture run passed after the redesign. A mobile layout check found no horizontal overflow. These checks do not claim newly connected Terse or model services.

## Hero asset

Saved locally at `web/public/images/skybridge-aircraft.png`. Generated with the built-in image-generation tool; it is a concept illustration, not a real aircraft photo or telemetry. The hero caption makes that distinction visible.

Final prompt:

> Use case: product-mockup. Create a premium 3D product-render website hero asset for SKYBRIDGE, a SIMULATED medical-supply drone coordination prototype. A single sophisticated unbranded white-and-graphite cargo quadcopter with four clearly constructed rotors, compact rectangular vivid blue supply case under its body, angled three-quarter view floating diagonally over a seamless very dark midnight navy studio background (#00102b). Restrained cyan rim light on the left and indigo violet rim light on the right; physically coherent materials, fine mechanical detail, soft motion blur on rotors only, cinematic technology advertising quality like a premium semiconductor brand campaign. Drone fills 75% of the image with generous dark negative space around all sides. Square image, centered subject. Background faint volumetric blue haze with subtle luminous cyan and purple floor reflections; sophisticated and understated, not busy, no circuit board stock art. No text, letters, logos, medical cross symbols, interface elements, map pins, badges, people, or real-world brand marks. This is a concept aircraft render, not real flight telemetry.
