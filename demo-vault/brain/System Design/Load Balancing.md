# Load Balancing

#system-design

## What It Is
A small idea with a large blast radius across everything downstream of it.

## How It Works
It works by pushing a decision to the point where the most context is available.

| Property | Value | Why |
|---|---|---|
| Cost | O(log n) | after the index is warm |
| Failure | loud | it fails closed |

## Why It Matters
Knowing this turns a class of surprising failures into an expected one.

## Connections
- Compare: [[Neuroplasticity]]
- Contrasts with: [[Bayes' Theorem]]
- See: [[System Design MOC]]

## Source
*Demo vault — synthetic content.*
