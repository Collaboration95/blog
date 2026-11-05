I’m happy to share that I’ve obtained a new certification: AWS Certified Solutions Architect Professional from Amazon Web Services (AWS)!

My first Professional certificate!

SAP tests whether you can design systems that span accounts, survive regional failures, and justify their cost. Not theoretical systems. The kind production teams actually run.

Used Stéphane Maarek's SAP-C02 course on Udemy and TutorialsDojo's practice tests.

The exam forces you to match patterns to business requirements rather than pick the safest option. That framing carries directly into real architecture decisions where budget and SLA are both hard constraints.

I had trouble choosing between the DR tiers for a long time. Most engineers treat backups as a checkbox. SAP makes you treat RTO and RPO as hard constraints from day one when building the system.

The four patterns, in order of cost vs. recovery speed:

Backup and Restore: store snapshots, restore on failure, RTO in hours. Cheapest. Fine for non-critical workloads.

Pilot Light: keep core services running at minimal capacity. Scale out on disaster. Faster than cold restore, cheaper than full standby.

Warm Standby: scaled-down production stack always running. Fast failover because the infrastructure already exists. You pay to keep it warm.

Multi-site Active-Active: full capacity in two regions, traffic split between them. Near-zero RTO. You're paying for two full stacks.

Happy to chat if you're prepping for the same.
