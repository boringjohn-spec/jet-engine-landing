# Kiln Propulsion · Ember K1 — landing page brief

Design research, mood board, content direction, structure and UX copy for the Ember K1 landing page. Brand and product are fictional (invented for this concept).

**Decisions made with you**
- Positioning: propulsion hardware company; the 3D model is the flagship flight-proven stack.
- Brand: invented — **Kiln Propulsion**, product **Ember K1** (hybrid N₂O / paraffin motor).
- Direction: graphite + amber, flipping to paper-white technical drawing during the exploded view.
- Goal: request specs / talk to an engineer (B2B).

---

## 1 · Research (Mobbin, web sections)

Queries run: aerospace/hardware hero with product render · hardware spec section with large numbers · feature section with exploded diagram and callouts · industrial contact-sales CTA · space/defense milestones timeline. A screen search for "rocket engine manufacturer landing page" returned nothing, so research leaned on adjacent deep-tech hardware (motors, eVTOL, drones, robotics, energy).

### Pattern clusters

**Hero: one hardware object, cropped big, specs on the side**
- [Joby Aviation](https://mobbin.com/sites/sections/19d5fe19-8d63-414a-a799-aef1911d2ec9): macro crop of the aircraft, left headline, three specs behind a thin vertical rule on the right. → Our hero spec trio.
- [Atlas](https://mobbin.com/sites/sections/178d1c34-3175-4c87-9151-fb4f7514c9e0): headline broken across a visible grid, boxed uppercase nav. [Loader](https://mobbin.com/sites/sections/9ed168ec-36d1-44a3-b238-3b3572b70406) with corner micro-labels. → Page-wide hairline columns, mono micro-labels.
- [Zipline](https://mobbin.com/sites/sections/3faf1b1e-c7e9-489b-bd53-552643429c38): condensed all-caps statement over a factory shot. → Condensed uppercase display type.

**Explaining the hardware: parts named on the object**
- [T1 Energy](https://mobbin.com/sites/sections/d768b5c8-b3a1-49c6-aff9-df1e13e4a440): layered cross-section on the left, layer list on the right with mono captions. → Exploded view with a parts list that tracks the drawing.
- [Zipline](https://mobbin.com/sites/sections/ce7e2b2b-54f9-4a13-952e-4a895a0f7c30): red hotspots on the product plus a condition toggle. [Rains](https://mobbin.com/sites/sections/0c9ca7d4-3523-44f2-93cf-ee3137acc9d7): floating labels around the silhouette. → Leader-line callouts, one highlighted at a time.

**Proof: numbers and spec sheets engineers trust**
- [SpaceXAI](https://mobbin.com/sites/sections/3dbbd5c1-3e61-4c38-aeec-7475b43e0e7f): three huge numbers, tiny captions, faint grid. [Railway](https://mobbin.com/sites/sections/deb1d5b0-2f1f-4c2b-9f46-0af85cf249cb): dark stat tiles. → Metrics band.
- [Fauna Robotics](https://mobbin.com/sites/sections/30698000-885e-4983-af51-e8a1fa72a043): tabbed spec table + "Full specs (PDF)" / "Technical report". [Rivian](https://mobbin.com/sites/sections/4e15c487-5553-4441-a9d7-29331a22361d): key/value table. [Ghost](https://mobbin.com/sites/sections/d2a5c3c6-d10f-4d64-bb8e-a306ac311f78): grouped accordion. → Tabbed spec groups.
- [In Common With](https://mobbin.com/sites/sections/6c5ddd6d-bd8e-4cbf-9616-8016064f2bdc): hairline spec table beside a Downloads list (tear sheet, 2D/3D drawing). → Documents panel; requests route into the form.

**Credibility over time**
- [Grok](https://mobbin.com/sites/sections/5809b85f-2e44-4d26-998f-9fb4e2379f13): hairline timeline, mono dates, dot markers, active marker. [Joby](https://mobbin.com/sites/sections/6944c2bb-f5b4-4bf0-b707-e4c048c17040): faded year stack. → Public test log, including an anomaly.

**Conversion for B2B hardware**
- [Framer](https://mobbin.com/sites/sections/914df681-c24d-4800-bd11-9c144d0175fb): dark split, headline + trust badges left, form right. [Replit](https://mobbin.com/sites/sections/806f6d22-2ce2-4505-905b-a01e818e51bb): mono labels with (Required)/(Optional), full-width accent button. [Superpower](https://mobbin.com/sites/sections/59bd2530-f395-46f0-98ef-2a6632ef6fdf): `[ bracket ]` buttons. → Contact section and nav CTA.
- [fal](https://mobbin.com/sites/sections/f51c042f-1fc6-4b62-a9ef-06ad11187090): giant wordmark footer. → KILN wordmark.

### What the patterns say
- Deep-tech hardware sites earn trust by **showing the object and its numbers early**, not by abstract claims. Every hero above pairs the product with 2–3 hard specs.
- The best explainers **name parts on the object itself** (hotspots, callouts, layer lists) instead of in a separate feature grid.
- B2B hardware conversion is **documents-first**: data sheet, interface docs, CAD envelope. Offering them as "request" (not fake downloads) is honest and qualifies the lead.
- Publishing failures (our HF-031 anomaly) is rare and a strong credibility move for a test-driven brand.

---

## 2 · Mood board

| Token | Value | Use |
|---|---|---|
| Graphite | `#0E0F10` | Page background (from the model's gunmetal) |
| Graphite 2 / 3 | `#151719` / `#1E2124` | Panels, footer wordmark |
| Bone | `#E8E4DA` | Primary text |
| Muted / Dim | `#9A968D` / `#64615B` | Secondary text, captions |
| Amber | `#F2A814` | The one accent (from the model's own safety markings) |
| Amber ink | `#A86A00` | Accent on paper |
| Paper | `#E6E2D8` | Exploded-view background |
| Ink | `#18191B` | Line drawing + text on paper |
| Warn | `#FF6A3D` | Anomaly chip, form errors |

**Type**: Archivo (variable width) set condensed (62–80%) and heavy for display; Archivo regular for body; IBM Plex Mono uppercase for labels, specs, data.

**Texture**: four hairline page columns (engineering drawing), bracketed buttons, mono micro-labels, live-status pips. Restraint: one accent colour, no gradients except the amber glow behind the hero object.

**Motion references**: [animejs.com](https://animejs.com) (scroll-driven explode → technical line drawing with callouts → reassemble) and [motion.dev](https://motion.dev) (cursor-reactive particle field). Both rebuilt from scratch with our own model, shapes and story.

---

## 3 · Content structure

| # | Section | Job | Interaction |
|---|---|---|---|
| 0 | Loader | Mask model load | Progress % |
| 1 | Hero | Say what it is + 3 specs + primary CTA | Parts scatter in and assemble; cursor parallax |
| 2 | Exploded view (pinned, ~7 screens) | Show it's built from swappable modules | Scroll: explode → paper line drawing → 12 callouts draw in, focus sweeps each part → reassemble |
| 3 | Metrics | Proof in three numbers | Count-up |
| 4 | Burn (pinned, ~4 screens) | Show the engineering process: model → fire → fly | Scroll morphs particles rocket → injector face → exhaust plume; cursor repels; click sends a pressure ring |
| 5 | Specifications | Answer integrators' first questions | Tabs (arrow keys), document requests prefill the form. The rocket returns behind the content, parking beside the heading |
| 6 | Test log | Credibility over time, including failures | Horizontal track with prev/next; the rocket rides the timeline line |
| 7 | Contact | Convert: talk to an engineer | Inline validation, confirmation with reply date |
| 8 | Footer | Wayfinding + brand moment | Rocket settles horizontally on an "at rest" dock above the giant wordmark |

---

## 4 · UX copy deck

**Voice**: an engineer talking to an engineer. Specific numbers over adjectives, short declaratives, no hype words ("revolutionary", "next-gen"). Admit trade-offs and failures.

**Nav**: Hardware · Burn · Specs · Test log · `[ Talk to an engineer ]` (mobile: `[ Contact ]`)

**Hero**
- Eyebrow: EMBER K1 · HYBRID PROPULSION STACK
- H1: **Thrust, on command.**
- Lede: A flight-ready hybrid motor, avionics and aero surfaces, delivered as one integrated stack. Throttle it, shut it down, refuel it, fly it again.
- CTAs: Request the data sheet → · See inside ↓
- Specs: 24 kN average thrust · 40–100% throttle range · 12 flights per case
- Status: SN-014 · In qualification

**Exploded view**
- Eyebrow: EXPLODED VIEW · 12 MODULES
- H2: **Twelve modules. One stack.**
- Body: Designed, machined and hot-fired under one roof. Any module swaps out on the pad, with no trip back to the factory.
- Callouts: 01 Air-data probe (Pitot-static, sampled at 1 kHz) · 02 Ogive fairing (Carbon/epoxy, 3:1 ogive) · 03 Payload adapter (Ø300 mm, 12-bolt interface) · 04 Flight computer (Triple-redundant, 1 kHz telemetry) · 05 Roll-control canards (Electromechanical, ±15°) · 06 Vent & fill valve (Pad-side N₂O fill and relief) · 07 N₂O oxidizer tank (Filament-wound carbon, 62 bar) · 08 Umbilical raceway (Power and data to the pad) · 09 Injector head (64 elements, printed Inconel 718) · 10 Fuel grain & chamber (Paraffin-HTPB, inert until lit) · 11 Fin can (4 × clipped delta, swappable) · 12 Ablative nozzle (Silica-phenolic, expansion ratio 8)
- Reassembled: REASSEMBLED · PAD-READY / **Back on the pad in 54 minutes.**

**Metrics**: Measured on our test stand, not on a slide · 432 kN·s total impulse per burn · 238 s specific impulse, vacuum · 0 kg explosive material on the pad. Fuel and oxidizer never meet until ignition.

**Burn**
- Eyebrow: FROM MODEL TO FLAME · H2: **Modelled. Fired. Flown.**
- 01 / Modelled: Every Ember is simulated down to the bolt before metal is cut: 1.4 million mesh cells per burn.
- 02 / Fired: 64 injector elements spray nitrous oxide across the fuel grain for an even, stable burn.
- 03 / Flown: Shock diamonds, 1 kHz telemetry, and a motor case that comes home for its next flight.
- Hint: Move through the field · click to pulse

**Specs**: H2 **The numbers integrators ask for first.** Tabs: Propulsion · Vehicle · Interfaces · Operations. Documents: Data sheet · Interface control document (Under NDA) · STEP envelope model (Under NDA) · Hot-fire report HF-047. Button: Request. Note: Requests go straight to our engineering team.

**Test log**: H2 **Every firing, on the record.** Body: We publish every hot-fire and flight, including the ones that didn't go to plan. Status chips: Pass · Anomaly · In progress.

**Contact**
- H2 **Talk to an engineer.** Body: Tell us what you're flying. An engineer, not a sales rep, replies within two working days.
- Assurances: Export-controlled data shared under NDA · Test-stand visits on request · Engineering support through first flight
- Fields: Name · Work email · Organization · Program (Suborbital research / Hypersonic testing / Upper-stage development / Something else) · Documents you need · What are you flying? (placeholder: Payload mass, target altitude, timeline)
- Button: Send to engineering → · Note: We only use your details to reply to this request.
- Errors: Enter your name. · Enter a work email like name@company.com. · Enter your organization. · Choose the program closest to yours.
- Success: REQUEST RECEIVED / **Thanks, {first name}.** An engineer will reply by {date + 2 working days}. If your program needs export-controlled data, we'll send an NDA first. · Send another request

**Footer**: © 2026 Kiln Propulsion · Concept site: Kiln and Ember are fictional.

> All specs, dates and test results are placeholder content written for this concept. Replace them with real figures before any public use.
