---
layout: post
title:  "Building in Public: Day 1"
date:   2026-07-14 09:00:00 +0200
categories: building-in-public
---

I'm going to build in the open. Every day I'll post a short entry documenting the work of building a real business: what I shipped, what I learned, what worked, and what didn't.

The rules are simple: one post a day, numbers, no polishing away the hard parts. The metric I'm using to know I've made something people actually want is $20,000 in monthly recurring.

This is day one. Let's see where it goes.

## What I'm building

The first idea I am working is an AI agent that talks to employees in their own language about how they actually do their job, and turns the transcripts into documentation the company keeps: SOP drafts, a process map, a list of the things nobody on the team could explain.

The target customer is the German Mittelstand manufacturer, roughly 50 to 500 people. Two things are colliding there right now. A generation of workers is retiring and taking undocumented knowledge with them, and these companies are often not very digital yet, so they don't have a lot of data that can feed AI agents even though there is valuable implicit knowledge.

Two things are supposed to make this different and defensible:

1. Data Residency: Everything is EU-hosted or self-hosted, no US subprocessors anywhere.
2. Pricing: Mostly one-time fee, low subscription to cover cost.

## My hypotheses

Before I believe this is a business, six assumptions have to hold, roughly in order of how much they scare me:

1. Owners and plant managers feel the knowledge-loss pain strongly enough to pay ca. five figures once.
2. A company will actually let an AI talk to its employees at all. Works councils, surveillance fears, culture.
3. Shop-floor workers actually talk usefully for 15 to 20 minutes in their own language.
4. Interviews alone already produce something a company would call a real first draft of documentation.
5. The EU-only voice stack is actually good enough on a noisy shop floor.
6. The one-time-fee economics work once I account for what it costs me to deliver each engagement.

I will be testing these in the next two weeks.

## What I built so far

A working MVP someone can sit down and use: upload a list of employees, write an interview guide, run the interview with consent, and get back SOP drafts, a process overview, and a gap list you can export. Interviews work in German, Turkish, and Polish.

Right now it only runs through a browser call, not a real phone call. I'm unclear on whether I need actual calling.

None of this is launched to the public yet because I haven't set up the infrastructure, but it works locally.

<p align="center"><img src="{{ '/assets/day1/interviews-dashboard.webp' | relative_url }}" width="750"></p>

## What's still open

1. GTM motion: I'm thinking about looking at companies with a succession problem or with a desire to sell as a wedge due to the more acute knowledge problem, I'm not sure about this though.
2. Branding and naming.

_Repo is private for now. Will open it up once there's something in it worth reading._
