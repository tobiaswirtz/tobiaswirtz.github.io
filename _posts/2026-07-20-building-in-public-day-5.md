---
layout: post
title:  "Building in Public: Day 5"
date:   2026-07-20 09:00:00 +0200
categories: building-in-public
---

Day 5. Two things: I shipped the on-prem rebuild that came out of the first interview, and I sat down to think seriously about how I'd ever reach this market at all.

## The on-prem rebuild

I turned the on-prem and trust work from day 3 and 4 into a real change. 

The interview killed my assumption that "EU-hosted" answers the data-residency objection. This buyer already turns down AI vendors because, in his words, none of them can actually run it locally, and he runs his own local LLM. But he doesn't want everything local either: quality-assurance paperwork can go to the cloud, bath compositions never. So the rebuild is built around that split:

1. **Data classification.** Every department guide is marked internal or secret, and one routing rule decides whether a class can be processed in EU cloud, locally, or not at all. It fails closed: a class this deployment isn't allowed to handle gets refused and reported, never quietly downgraded to the cloud. The rule binds the live voice call too, not just the write-up, because the transcript contains whatever the interview was about.
2. **Worker trust surface.** A concrete, translated reason spoken in the consent script and shown on the link page, a non-surveillance guarantee, role-only attribution so employee names never enter a prompt, and a withdrawal button that actually deletes the transcript instead of flagging it.
3. **On-prem stack.** Per-class LLM endpoints, an Ollama + faster-whisper profile bound to localhost, a preflight check to run in front of the customer at handover, and a transparency page that renders the real data flow from live config as an attachment for the works council.

Two follow-up commits added a **reminder budget** (at most two chase messages, then the name moves to a manager-round list rather than a third SMS) with a coverage view, and fixed the admin UI printing raw status values in an otherwise translated app. 52 tests passing, smoke-tested end to end.

Building on-prem doesn't validate the hypothesis that on-prem is what unlocks the sale. It just makes the real test possible, which is to go back to this same interviewee with a working local deployment and ask for a paid pilot.

## Channel experiments

I wrote up a set of growth bets for werkdoku, borrowing the spirit of a "grow an app for almost nothing" playbook but reframing it, because werkdoku is the opposite shape: a five-figure one-time sale to a narrow, conservative buyer (owner, production manager, or quality manager at 50–500-person mid-sized German manufacturers), not a free consumer download. So the metric for every bet is *qualified pilot conversations with the right buyer*, not traffic.

Each bet is written as a hypothesis with a signal and a kill/go threshold. The three I'd start with:

- A free **knowledge-loss risk self-assessment** that a production manager runs and forwards to their boss, outputting a euro-quantified risk estimate. It manufactures the pain in the buyer's own numbers.
- The **live demo as spectacle** at a chamber-of-commerce or industry-association event: interview a volunteer on stage and generate an SOP draft in minutes, which de-risks the "will they let an AI call employees" fear in front of the exact buyer.
- The **public digitalization and subsidy channel**: public programs that exist to push tools like this to this buyer for free, plus checking whether an engagement qualifies for funding.

## Tomorrow

1. Create a landing page.
2. Plan one of the channel experiments.
