# Challenge Contract — Interplanetary Survival Guide: Martian Map

**Source:** NASA Space Apps Challenge 2026  
**Challenge:** Interplanetary Survival Guide: Martian Map  
**Difficulty:** Intermediate  
**Theme:** The Next Frontier  
**Event Dates:** November 14–15, 2026

---

## WHAT NASA EXPLICITLY ASKS

### Problem
NASA has decades of robotic Mars exploration data from multiple missions. As the agency prepares to send humans to Mars, astronauts will require comprehensive, reliable maps that integrate information from these multiple sources to navigate safely and conduct science.

### Target User
A future human explorer (astronaut) preparing to walk on the Martian surface.

### User Objective
Plan and execute a safe, scientifically valuable Marswalk (EVA on Mars).

### Mission Context
- Multiple prior NASA robotic missions have mapped Mars extensively
- Data exists across multiple instruments, missions, and formats
- Future human explorers need to synthesize this data for surface operations

### Required Map Capabilities
1. **Layered view** — multiple data types shown in integrated layers
2. **Integrated view** — data from multiple NASA missions synthesized into a coherent presentation
3. **Specific location OR route** — focused on a particular Martian region or traverse path
4. **Multi-mission data** — must combine data from more than one NASA science mission

### Required NASA Data Usage
- Must use data from multiple NASA science missions
- Data must be real/verified NASA open data
- Integration across mission datasets is a core requirement

### Expected Outputs
1. A layered, integrated map of a Martian location or route
2. Information that supports safe Marswalk planning
3. Identification of science opportunities along the way

### Scientific Expectations
- Enable "new and exciting science" during the Marswalk
- Identify scientific features of interest
- Help astronauts understand their geological/environmental surroundings

### Safety Considerations
- Route/location information must support astronaut safety
- Environmental condition awareness (temperature, dust, etc.)
- Terrain/hazard awareness

### Route/Location Requirements
- Must focus on a specific Martian location OR route
- Not a whole-planet overview (though context may be provided)

### Constraints
- Must use open NASA data
- Intermediate difficulty — substantial but achievable in a hackathon
- Multi-mission data integration is mandatory
- The map must be the primary interface

### Recommended Skills (from challenge page)
- AI/ML
- Coding
- Data Analysis
- Data Visualization
- GIS
- Software Development
- Web Development

---

## WHAT WE CAN INFER AS A STRONG OPPORTUNITY

> ⚠️ These are inferences, NOT official requirements.

### 1. Terrain-Aware Route Planning
NASA's emphasis on "route" and "navigation" strongly implies that showing traversability (slope, roughness, obstacles) creates high value. An astronaut doesn't just need to see a map — they need to know which path is walkable.

### 2. Multi-Objective Decision Support
The dual requirement of "safety" AND "science" implies a trade-off that the system could help resolve. The most scientifically interesting route may not be the safest. This is an optimization opportunity.

### 3. Science Opportunity Discovery
"New and exciting science along the way" implies the system should proactively identify science targets near or along a route — not just display them passively.

### 4. Environmental Condition Awareness
Temperature, dust, atmospheric conditions — these affect EVA safety. Showing current/estimated conditions adds operational value.

### 5. Evidence-Based Decision Making
Judges will value systems that explain WHY a route or location is recommended, not just WHAT the recommendation is. Provenance of NASA data supporting each conclusion strengthens scientific credibility.

### 6. Uncertainty Communication
Mars data has gaps, varying resolution, and temporal limitations. Acknowledging and visualizing uncertainty demonstrates scientific maturity.

### 7. Scenario Comparison
"What if the mission prioritizes science over safety?" or "What if conditions change?" — allowing users to explore trade-offs demonstrates analytical depth.

### 8. Real Computational Intelligence
The challenge recommends AI/ML skills. This suggests judges expect computational processing beyond mere data display — pattern recognition, optimization, prediction, or intelligent recommendation.

### 9. Jezero Crater as Focus Region
The reference image specifically shows Jezero Crater (Perseverance rover landing site). This is ideal: richest NASA data density, most science targets, proven geological interest, public recognition.

### 10. Mission Report Generation
An astronaut or mission planner needs a summarized, actionable output — not just a map view. A generated mission report adds practical value.

---

## Separation of Required vs. Opportunity

| Capability | Required? | Opportunity? |
|---|---|---|
| Layered Mars map | ✅ YES | — |
| Multi-mission NASA data | ✅ YES | — |
| Specific location/route focus | ✅ YES | — |
| Safety-relevant information | ✅ YES | — |
| Science target identification | ✅ YES | — |
| Route planning/optimization | — | ✅ Strong |
| Multi-objective trade-offs | — | ✅ Strong |
| Evidence/provenance | — | ✅ Strong |
| Scenario comparison | — | ✅ Moderate |
| Environmental conditions | — | ✅ Moderate |
| Uncertainty visualization | — | ✅ Moderate |
| AI/ML-driven intelligence | — | ✅ Moderate |
| Mission report export | — | ✅ Nice-to-have |
