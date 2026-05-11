# POS Ticket System — Plan

## Why

The restaurant currently has no concept of a meal session. Each round of ordering creates a separate charge on the folio, and there's no receipt generated for the customer at the table. The goal is to group all orders from a single meal into one ticket, produce a receipt when the table closes out, and automatically handle meal-plan-covered meals without generating a bill or posting to the folio.

---

## The Ticket

A ticket is a session that represents one meal at the restaurant. Staff open a ticket before taking any orders, add items to it across multiple rounds, and close it when the guest is done.

When a ticket is opened, staff select:
- The guest's room (optional for walk-ins, required for meal plan checks)
- The meal type — prefilled based on current time (Breakfast before 11am, Lunch 11am–3pm, Dinner after 3pm) but staff can change it. Snack is also available and is never covered by any meal plan.

Orders placed under an open ticket are held in a pending state and don't touch the folio until the ticket is closed.

When a ticket is closed, two things happen (or don't, if the meal is covered — see below):
1. A single charge is posted to the guest's folio covering the full ticket amount, described as "Restaurant Order - Ticket #[number]"
2. A receipt PDF is generated from all the items on the ticket

Payment itself is not part of closing the ticket — it flows through the normal folio payment process.

Multiple tickets can be open at the same time for different tables. The sidebar showing open tickets displays the room number prominently for hotel guests, or the guest's name for walk-ins.

---

## Meal Plan Integration

When a hotel guest's booking includes a meal plan, covered meals should not be billed. The meal plan types in the system are:

- **CP** (Continental Plan) — covers Breakfast only
- **MAP** (Modified American Plan) — covers Breakfast and Dinner
- **AP** (American Plan) — covers all three meals (Breakfast, Lunch, Dinner)

When a ticket is closed for a hotel guest, the backend checks whether the guest's meal plan covers the selected meal type. If it does:
- No charge is posted to the folio
- No receipt is generated
- The orders are marked as meal-plan-covered and recorded in order history for reporting

If the meal is not covered (wrong meal type for their plan, snack selection, or no plan at all), the normal flow applies — one folio charge, one receipt.

Walk-in guests are always billed regardless.

**Coverage is whole-ticket.** If the meal type is covered, the entire ticket is free. If a guest on a breakfast plan orders something that shouldn't be on the house (a mimosa, a premium add-on), the correct workflow is for staff to open a second ticket for those items with meal type set to Snack — Snack is never covered and always billed. This keeps the logic simple without needing to tag individual products.

---

## What Gets Built

**Backend:**
- A new Ticket entity that groups orders and tracks status (open/closed), the selected meal type, the guest/room link, and the receipt URL once generated
- A new receipt service that generates a standalone restaurant receipt PDF — completely separate from the hotel invoice system (no invoice sequences, no bill types)
- New endpoints to open a ticket, add orders to it, and close it
- Logic in the close-ticket flow that checks the guest's meal plan coverage before deciding whether to post a charge and generate a receipt

**Frontend:**
- An "Open Ticket" button that replaces the current direct cart-to-folio flow
- A modal when opening to select room, guest name (for walk-ins), and meal type (time-prefilled, editable)
- Cart orders go to the active ticket instead of directly to the folio
- A "Close Ticket" action that handles the walk-in vs hotel guest distinction and determines which folio to post to
- An open tickets sidebar with room number or guest name as the prominent label on each ticket card

---

## Reporting

Meal-plan-covered orders are still saved as POS orders with a covered status. They appear in order history and count toward volume reporting — kitchen and F&B managers can see what was consumed under meal plans even when nothing was billed.
