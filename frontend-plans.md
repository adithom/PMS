### immediate
- [x] rooms - vacant white, booked green
- [ ] tailwind migration 
- [ ] admin billing console
- [ ] frontend billing manager
- [ ] twin bedded rooms - check box while booking creation
- [ ] birthday celebration pop up
- [x] calender modification
- [ ] separate booking form for group booking

### next
- reports

The Front Desk Billing Manager (Operational View)

This page should be heavily optimized for speed and daily operations. The Front Desk agent only cares about the property they are standing in, and they mostly care about the people checking out today or guests currently at the desk.

    The "At a Glance" Header: Instead of just a list, have quick-filter metric cards at the top:

        Departing Today (Open Balances): Guests who need to pay before they leave.

        In-House (High Balances): Guests whose open folios have crossed a certain threshold (e.g., ₹50,000) and might need a mid-stay payment.

        Closed Folios: Recently settled accounts.

    The Data Grid: A clean table showing: Room # | Guest Name | Folio Status (Open/Closed/Posted) | Total Charges | Paid | Balance Due (highlighted in red if > 0, green if 0).

    Quick Search: A prominent search bar that instantly filters by Room Number or Guest Name.
