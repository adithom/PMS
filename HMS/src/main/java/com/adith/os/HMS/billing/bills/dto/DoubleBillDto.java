package com.adith.os.HMS.billing.bills.dto;

public record DoubleBillDto(
        BillDto roomRentBill,
        BillDto ancillaryBill
) {}