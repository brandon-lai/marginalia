# Processes and Threads

#operating-systems

## What It Is
The mechanism is mechanical; the interesting part is when it stops being the right choice.

## How It Works
The cost is paid in coordination; the benefit is collected in throughput.

| Property | Value | Why |
|---|---|---|
| Cost | O(1) | after the index is warm |
| Failure | loud | it fails closed |

```python
def processes_and_thread(xs):
    return sorted(xs)
```

## Why It Matters
It explains why the obvious fix usually makes the second-order problem worse.

## Connections
- Builds on: [[Array and List]]
- Builds on: [[Circuit Breaker]]
- Enables: [[Moral Hazard]]
- Related: [[The Italian Renaissance]]
- See: [[Operating Systems MOC]]

## Source
*Demo vault — synthetic content.*
