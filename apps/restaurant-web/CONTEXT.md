# Restaurant web context — drone delivery application

`/drone-delivery` shows only locations owned by or assigned to the current user through the authenticated managed-branches API. Legacy restaurant owners keep their existing role and restaurant data.

Application states: not registered, pending, approved, rejected. Initial/rejected profiles are editable; pending/approved profiles are read-only. Profile fields: address, latitude/longitude, contact name/phone, handover location notes. Review reason is visible to the managing user.

Only approved profiles expose the operation switch. Approval does not enable service. Disabling preserves approval and received orders. UI guards are usability only; the API independently enforces all permissions and transitions.

No brand upgrades, manager account creation or per-branch food availability are introduced.
