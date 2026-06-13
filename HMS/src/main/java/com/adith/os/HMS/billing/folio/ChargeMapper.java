package com.adith.os.HMS.billing.folio;

import com.adith.os.HMS.billing.folio.Folio;
import com.adith.os.HMS.billing.folio.FolioCharge;
import com.adith.os.HMS.billing.folio.dto.ChargeCreationDto;
import com.adith.os.HMS.billing.folio.dto.ChargeDto;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

@Component
public class ChargeMapper {

    private ChargeMapper() {
        // Utility class
    }

    /* =========================================================
       ENTITY → DTO
       ========================================================= */

    public static ChargeDto toDto(FolioCharge charge) {
        return new ChargeDto(
                charge.getId(),
                charge.getChargeDate(),
                charge.getPostingDate(),
                charge.getChargeCode(),
                charge.getDescription(),
                charge.getReferenceType(),
                charge.getQuantity(),
                charge.getUnitPrice(),
                charge.getSubtotal(),
                charge.getTaxRate(),
                charge.getTaxAmount(),
                charge.getDiscountAmount(),
                charge.getTotalAmount(),
                charge.isVoided(),
                charge.getVoidReason(),
                charge.getNotes()
        );
    }

    public static List<ChargeDto> toDtos(List<FolioCharge> charges) {
        return charges.stream()
                .map(ChargeMapper::toDto)
                .toList();
    }


    /* =========================================================
       CREATION DTO → ENTITY
       ========================================================= */

    public static FolioCharge toEntity(
            ChargeCreationDto dto,
            Folio folio
    ) {

        FolioCharge charge = new FolioCharge();

        charge.setFolio(folio);
        charge.setChargeDate(dto.chargeDate());
        charge.setChargeCode(dto.chargeCode());

        charge.setDescription(
                dto.description() != null
                        ? dto.description()
                        : dto.chargeCode().name()
        );

        BigDecimal quantity =
                dto.quantity() != null ? dto.quantity() : BigDecimal.ONE;

        BigDecimal taxRate =
                dto.taxRate() != null ? dto.taxRate() : BigDecimal.ZERO;

        BigDecimal discountRate =
                dto.discountRate() != null ? dto.discountRate() : BigDecimal.ZERO;

        charge.setQuantity(quantity);
        charge.setUnitPrice(dto.unitPrice());
        charge.setTaxRate(taxRate);

        // Let entity calculate subtotal, tax, discount, total
        charge.calculateAmounts();

        charge.setNotes(dto.notes());
        charge.setPostedBy(dto.postedBy());

        return charge;
    }
}