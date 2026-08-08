# Homebase
The concept is bascially gamifcation of self improvement to :
allow users to log and develop good habits
deep focused work
a more purpose-filled life




This app is not a cafe simulator. Its a personal development game with a cat cafe theme.


1 min focus = 1 pearl

Pearls give:
upgrades to 
cat treats



There should be a cat chest opener to unlock new cats


Coins used for cafe expansions, new locations, machinery, etc. 


 each day there can be an app dailogue before the user enters


 The Economic LoopPearls = Production

1 pearl per minute of focus = 1 boba made
Completing habits = bonus pearls (batch production)
Pearls sit in inventory as "made boba"
Cats = Customers

Cats spawn and queue up to buy boba
Each cat wants a drink (costs 1-3 pearls depending on fancy)
When cat buys → user gets coins
Cats leave happy (or impatient) based on wait time
Coins = Café Growth

Invest in café upgrades (counter speed, seating, ambiance)
Better café = cats want to come back = more customers
Creates a growth loop that requires focus to sustain

The Pressure Mechanic (This is where it gets real)
Queue visualization:

User opens app, sees cats waiting in line
They can see the queue getting longer in real-time
Cats start to look impatient if they wait too long
This creates natural motivation: "I need to focus to make boba to serve these cats"

Timeline:

Cat arrives and joins queue
If served within 5 minutes → happy, full coin payout
If served in 5-15 minutes → okay, reduced coins
If served after 15 minutes → cat leaves upset, no coins, loses reputation

The ritual becomes:

User opens app
Sees queue of waiting cats
"I need to focus now to make boba"
Starts a focus session
Pearls accumulate = boba gets made
After focus, serves the cats, gets coins
Uses coins to upgrade café
Better café = more cats come = bigger incentive to focus









# Focus Café

Focus Café is a simulation-based self-development app where real-world focus is translated into in-game progression through a living cat café environment.

The project is built using React Native (Expo) with a custom Canvas rendering system and game loop. It emphasizes real-time interaction, autonomous agent behavior, and clean, scalable architecture.

---

## Overview

Focus Café combines productivity and simulation by allowing users to interact with a café populated by cats that behave as independent agents.

Users can spawn cats, serve them, and watch them move through a system of queues and seating. The long-term goal is to connect this simulation to real-world focus sessions and habit tracking.

---

## Features

### Simulation System

- Real-time 2D simulation using HTML5 Canvas
- Custom game loop powered by requestAnimationFrame
- Autonomous agents (cats) with independent movement and state

---

### Cat Behavior

- Cats spawn in groups of 1 to 3
- Group members:
  - Move side-by-side
  - Stay together in queue
  - Sit at the same table
- Solo cats:
  - Prefer empty tables
  - Occasionally join occupied tables based on probabilistic logic

---

### State System

Each cat follows a defined state machine:
walkingToLine → waiting → walkingToSeat → seated
- Movement is smooth and continuous
- State transitions occur based on proximity to targets

---

### Queue System

- Groups occupy a single queue slot
- Cats within a group maintain horizontal spacing
- Queue dynamically updates as new cats spawn

---

### Seating System

- 10 tables (5 on each side)
- Each table seats up to 3 cats
- Intelligent seat allocation:
  - Groups are assigned to tables with enough space
  - Tables are selected based on availability and group size
  - Solo cats may join occupied tables with low probability

---

### Interaction

- Spawn button:
  - Generates a group of cats
- Serve button:
  - Serves the front group in queue
  - Awards coins
  - Sends group to a table

---

### Currency System

- Coins:
  - Earned by serving cats
  - Represents short-term reward

- Pearls (planned):
  - Intended for long-term progression tied to focus sessions

---

### Rendering System

- Entire UI is rendered using Canvas
- Includes:
  - Café layout
  - Custom counter shape
  - Tile-based flooring
  - Tables and seating
  - Procedurally drawn cat characters

---

## Tech Stack

- React Native (Expo)
- TypeScript
- HTML5 Canvas
- requestAnimationFrame for animation loop

---

## Architecture

### Game Loop

- Central render loop updates:
  - Cat movement
  - State transitions
  - UI rendering

---

### Entity Model

Each cat is represented as:
Cat {
id: string
groupId: string
x: number
y: number
targetX: number
targetY: number
speed: number
state: CatState
seatIndex: number | null
}---

### Group System

- Cats are grouped using a shared groupId
- Group logic controls:
  - Movement alignment
  - Queue positioning
  - Seating behavior

---

### Seating Algorithm

- Tables are defined by grouped seat indices
- System evaluates:
  - Available seats
  - Occupied seats
  - Group size
- Allocation rules:
  - Groups prefer empty tables
  - Solo cats may join partially filled tables
  - Fallback to any available seat if necessary

---

## Current Status

- Core simulation and rendering system implemented
- Group behavior and seating logic functional
- UI layout and interaction stable

---

## Future Improvements

- Integrate focus timer system
- Connect pearls currency to real-world productivity
- Add animations (idle, walking variations)
- Improve pathfinding and collision avoidance
- Enhance visual polish (sprites, lighting, depth)
- Add sound design and feedback
- Expand café progression system

---

## Author

Saaketh Aluri