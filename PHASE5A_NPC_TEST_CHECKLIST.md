# Phase 5A Test Checklist: NPC Spawn + Basic Movement

## Setup
- Start server: `npm run build && node index.mjs`
- Join as player
- Build a restaurant plot with:
  - **1 stove** (placed item)
  - **1 table** (placed item)
  - Or use `/cheat-setup` if available
- Open restaurant by toggling `restaurantSettings.isOpen = true`

---

## Test Cases

### **1. NPC Spawning**
**Expected:** NPCs spawn at regular intervals.
- [ ] After opening restaurant, wait ~6 seconds
- [ ] Verify in server logs: `[NPC Spawner] spawned npc-{id} NPC-001 target=(...)`
- [ ] After ~12 seconds, verify `NPC-002` spawned
- [ ] Verify max 5 NPCs spawn (check config: `NPC_MAX_CONCURRENT = 5`)
- [ ] **Logging passes** ✓

### **2. NPC Entity Creation & Unique ID**
**Expected:** Each NPC has unique ID + debug name.
- [ ] Check server logs for `[NPC] spawned npc-{timestamp}-{random} NPC-00X @(x, y, z)`
- [ ] Verify IDs are unique (no duplicates in logs)
- [ ] Verify debug names increment: `NPC-001`, `NPC-002`, `NPC-003`, etc.
- [ ] **Unique IDs + debug names verified** ✓

### **3. NPC Movement (Deterministic & Delta-Time Based)**
**Expected:** NPCs move toward target at constant speed (3.0 units/sec).
- [ ] Spawn NPCs and observe movement in world
- [ ] Check server logs: `[NPC] moving npc-{id} dist={distance}`
- [ ] Verify movement is smooth (no stutters)
- [ ] Verify movement direction = spawn point → target point
- [ ] Verify movement speed ≈ 3.0 units/second
- [ ] **Movement is deterministic and frame-rate independent** ✓

### **4. NPC Arrival Detection**
**Expected:** NPC detects arrival at target (within 0.5 unit threshold).
- [ ] Wait for NPC to reach target point
- [ ] Check server logs: `[NPC] arrived npc-{id} NPC-00X after {elapsedMs}ms`
- [ ] Verify arrival only logged once per NPC
- [ ] Verify `sim.lastArrivedNpcId` is updated to the arriving NPC's ID
- [ ] **Arrival detected correctly** ✓

### **5. NPC Cleanup After Arrival**
**Expected:** NPCs despawn 8 seconds after arrival.
- [ ] After arrival log appears, wait ~8 seconds
- [ ] Check server logs: `[NPC Spawner] cleaned up npc-{id} NPC-00X aged {totalAgeMs}ms`
- [ ] Verify `[NPC] despawned npc-{id}` logged
- [ ] Verify active NPC count in HUD decreases
- [ ] **NPCs cleaned up after arrival** ✓

### **6. Max Concurrent NPC Limit**
**Expected:** Max 5 NPCs active simultaneously.
- [ ] Let spawner run uninterrupted for 30 seconds
- [ ] Check logs for spawn rate: ~1 every 6 seconds
- [ ] Verify active NPC count never exceeds 5
- [ ] Once older NPCs arrive & cleanup, new ones spawn
- [ ] **Max concurrent limit enforced** ✓

### **7. Debug Overlay (Sim Stats)**
**Expected:** HUD shows NPC stats.
- [ ] Check HUD state payload (via `pushHUDState`)
- [ ] Verify `simDebug` object includes:
  - `activeNPCCount`: current spawned NPCs (0-5)
  - `npcLastSpawnTime`: last spawn timestamp (ms)
  - `npcSpawnInterval`: 6000 (ms)
  - `lastArrivedNpcId`: id of last NPC that arrived (or null)
- [ ] Values update as NPCs spawn/arrive
- [ ] **Debug overlay displays correct stats** ✓

### **8. Restaurant Close → NPC Cleanup**
**Expected:** All NPCs despawn when restaurant closes.
- [ ] Leave restaurant open for 30+ seconds (allow NPCs to spawn)
- [ ] Close restaurant via action `{ action: 'toggleRestaurant', opening: false }`
- [ ] Check server logs: `[NPC Spawner] cleared X NPCs`
- [ ] Verify `clearSimState` called for plot
- [ ] Verify `sim.npcs` Map is empty
- [ ] Verify no NPCs visible in world
- [ ] No `[NPC] moving` logs after closure
- [ ] **Cleanup on closure works** ✓

---

## Edge Cases / Advanced Validation

### **A. Multiple Players / Multiple Plots**
- If server supports multiple plots, test that:
  - [ ] Each plot has independent NPC spawner
  - [ ] NPCs don't spawn on other plots
  - [ ] Closing one plot doesn't affect other plots' NPCs

### **B. Spawn Point Discovery**
- [ ] Verify spawner uses `plot.entrance` as fallback spawn point
- [ ] Test with explicit "spawn_point" placed items (if catalog supports)
- [ ] Verify target discovery uses table positions (seating zones)

### **C. No NPC Leaks**
- [ ] Open/close restaurant 5 times
- [ ] Check server memory doesn't grow unbounded
- [ ] Verify all NPCs cleaned up after each close

### **D. Delta-Time Consistency**
- [ ] Enable server throttling / frame-rate changes
- [ ] Verify movement distance per frame stays consistent
- [ ] No sudden jumps or stops in NPC motion

---

## Logging Summary

| Log Entry | When | Expected Frequency |
|-----------|------|-------------------|
| `[NPC] spawned npc-{id} {debugName}` | NPC created | ~1 per 6 sec |
| `[NPC] moving npc-{id} dist=X.XX` | NPC moving toward target | Every frame |
| `[NPC] arrived npc-{id}` | NPC reaches target | Once per NPC |
| `[NPC Spawner] cleaned up npc-{id}` | NPC removed after 8sec delay | 1 per arrival, delayed |
| `[NPC] despawned npc-{id} {debugName}` | Entity removed from world | Once per cleanup |
| `[NPC Spawner] cleared X NPCs` | Restaurant closed | On closure |

---

## Success Criteria

✅ All 8 test cases pass  
✅ No TypeScript errors on build  
✅ No runtime errors on console  
✅ NPCs spawn reliably at 6-second intervals  
✅ Movement is smooth and deterministic  
✅ Arrival detected within 0.5 unit threshold  
✅ NPCs cleaned up after 8 seconds of arrival  
✅ Debug HUD shows accurate stats  
✅ Closing restaurant clears all NPCs  

---

**Phase 5A Validated:** NPC Spawner + Movement System ready for integration with customer orders in Phase 5B.
