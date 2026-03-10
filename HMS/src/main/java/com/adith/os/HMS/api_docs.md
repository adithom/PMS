# HMS API Docs

## Base URL
http://localhost:8080/api

### Properties
#### POST /properties

Body:

{
"name": "Grand Hotel",
"code": "GH001",
"address": "123 Main St",
"region": "Kerala",
"country": "IN",
"postalCode": "682001",
"phone": "+91-9876543210",
"checkInTime": "14:00:00",
"checkOutTime": "11:00:00"
}


#### GET /properties/

#### GET /properties/{id}

#### GET /properties/code/{code}

#### GET /properties?q=Grand                    
#### GET /properties?country=IN                 
#### GET /properties?region=Kerala              
#### GET /properties?page=0&size=20             

#### GET /properties/search?name=Hotel&country=IN&minRooms=10&maxRooms=100

#### PUT /properties/{id}

#### PATCH /properties/{id}

#### DELETE /properties/{id}

### Units

#### POST /properties/{propertyId}/units

Body:

{
"name": "Building A",
"sortOrder": 1
}

#### GET /properties/{propertyId}/units/{id}

#### GET /properties/{propertyId}/units/name/{name}

#### GET /properties/{propertyId}/units

#### PUT /properties/{propertyId}/units/{id}

#### PATCH /properties/{propertyId}/units/{id}

#### DELETE /properties/{propertyId}/units/{id}

### Rooms

#### POST /properties/{propertyId}/rooms

Body:

{
"number": "101",
"type": "Deluxe",
"capacity": 2,
"baseRate": 5000.00,
"status": "ACTIVE",
"unitId": "uuid-here",
"lastMaintained": "2025-01-15T10:00:00Z"
}

Room Status: ACTIVE, IN_MAINTENANCE, QUEUED_FOR_MAINTENANCE, INACTIVE

#### GET /properties/{propertyId}/rooms/{id}

#### GET /properties/{propertyId}/rooms/number/{number}

#### GET /properties/{propertyId}/rooms

#### GET /properties/{propertyId}/rooms/unit/{unitId}

#### GET /properties/{propertyId}/rooms/status/ACTIVE

#### PUT /properties/{propertyId}/rooms/{id}

#### PATCH /properties/{propertyId}/rooms/{id}

#### DELETE /properties/{propertyId}/rooms/{id}

### Guests

#### POST /guests

Body:

{
"firstName": "John",
"lastName": "Doe",
"email": "john@example.com",
"phone": "+91-9999999999",
"docId": "DL123456"
}

#### GET /guests/{id}

#### GET /guests/email/{email}

#### GET /guests/phone/{phone}

#### GET /guests/doc/{docId}

#### GET /guests

#### GET /guests?search=john    

#### PUT /guests/{id}

#### PATCH /guests/{id}

#### DELETE /guests/{id}

### Bookings

#### POST /properties/{propertyId}/bookings

Body:

{
"guestId": "uuid-here",
"unitId": "uuid-here",
"roomId": "uuid-here",
"checkIn": "2025-12-01",
"checkOut": "2025-12-05",
"adults": 2,
"children": 1,
"currency": "INR",
"totalPrice": 20000.00,
"paidAmount": 5000.00,
"specialRequests": "Late check-in",
"status": "CONFIRMED"
}

Booking Status: PENDING, CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW

#### GET /properties/{propertyId}/bookings/{id}

#### GET /properties/{propertyId}/bookings
#### GET /properties/{propertyId}/bookings?status=CONFIRMED
#### GET /properties/{propertyId}/bookings?checkInFrom=2025-12-01&checkInTo=2025-12-31

#### GET /properties/{propertyId}/bookings/guest/{guestId}

#### GET /properties/{propertyId}/bookings/room/{roomId}

#### GET /properties/{propertyId}/bookings/unit/{unitId}

#### GET /properties/{propertyId}/bookings/date?date=2025-12-15

#### PUT /properties/{propertyId}/bookings/{id}

#### PATCH /properties/{propertyId}/bookings/{id}
 
#### POST /properties/{propertyId}/bookings/{id}/assign-room?roomId={roomId}

#### POST /properties/{propertyId}/bookings/{id}/check-in

Check-in also assigns the room if not already assigned.

#### DELETE /properties/{propertyId}/bookings/{id}

### Availability

#### GET /availability/properties/{propertyId}?checkIn=2025-12-01&checkOut=2025-12-05

#### GET /availability/rooms/{roomId}?checkIn=2025-12-01&checkOut=2025-12-05

#### GET /availability/properties/{propertyId}/daily?startDate=2025-12-01&endDate=2025-12-31

#### GET /availability/properties/{propertyId}/occupancy?date=2025-12-15

#### GET /availability/properties/{propertyId}/occupancy/period?startDate=2025-12-01&endDate=2025-12-31

#### GET /availability/units/{unitId}?checkIn=2025-12-01&checkOut=2025-12-05

#### GET /availability/units/{unitId}/occupancy?date=2025-12-15

POST   /api/properties/{propertyId}/folios
Create new folio

GET    /api/properties/{propertyId}/folios/{id}
Get folio basic info

GET    /api/properties/{propertyId}/folios/{id}/details
Get folio with all charges and payments

GET    /api/properties/{propertyId}/folios/booking/{bookingId}
Get master folio for booking

GET    /api/properties/{propertyId}/folios/booking/{bookingId}/all
Get all folios for booking (split billing)

GET    /api/properties/{propertyId}/folios/open
Get all open folios

POST   /api/properties/{propertyId}/folios/{id}/charges
Add charge to folio

DELETE /api/properties/{propertyId}/folios/{id}/charges/{chargeId}/void?reason=X
Void a charge

PATCH  /api/properties/{propertyId}/folios/{id}/close
Close folio for checkout

PATCH  /api/properties/{propertyId}/folios/{id}/post
Post folio after payment

PATCH  /api/properties/{propertyId}/folios/{id}/reopen
Reopen folio for corrections

POST   /api/properties/{propertyId}/folios/{folioId}/payments
Record new payment

GET    /api/properties/{propertyId}/folios/{folioId}/payments/{id}
Get payment by ID

GET    /api/properties/{propertyId}/folios/{folioId}/payments
Get all payments for folio

PATCH  /api/properties/{propertyId}/folios/{folioId}/payments/{id}
Update payment details

PATCH  /api/properties/{propertyId}/folios/{folioId}/payments/{id}/complete
Complete pending payment

PATCH  /api/properties/{propertyId}/folios/{folioId}/payments/{id}/fail?reason=X
Mark payment as failed

POST   /api/properties/{propertyId}/folios/{folioId}/payments/{id}/refund
Process refund

DELETE /api/properties/{propertyId}/folios/{folioId}/payments/{id}
Cancel pending payment

GET    /api/properties/{propertyId}/payments?startDate=X&endDate=Y&status=COMPLETED
Get payments by date range for reporting


