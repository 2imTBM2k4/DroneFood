# Admin web context — branch drone application review

The Branches page reads the private administrator branch-list endpoint and can filter application states independently of the operating switch and branch status.

Branch details show the application address/coordinates, contact, handover notes, submission/review timestamps and latest reason. Administrators may approve or reject a pending application only with a nonempty reason. The exact submission identifier is sent with the decision; conflicts refresh the private profile rather than overwriting a newer submission.

Approval does not activate delivery. Owners/assigned managers enable the separate operation switch. Decisions are recorded in the existing API audit trail; the existing Audit Log page remains the history view.
