package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.billing.bills.dto.GroupDoubleBillDto;
import com.adith.os.HMS.billing.folio.dto.ChargeDto;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.File;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Generates PDF invoices for group bookings.
 *
 * Layout per bill (ROOM_RENT or ANCILLARY):
 *   - Hotel header + group/organizer info
 *   - For each room: a mini-section header (room number, guest name) followed
 *     by that room's charge line-items
 *   - Group totals at the bottom
 *
 * Returns the file path of the generated PDF, same contract as PdfGenerationService.
 */
@Service
public class GroupPdfGenerationService {

    private static final Color HEADER_COLOR = new Color(33, 58, 90);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    @Value("${hms.billing.invoice-storage-path:./hms-data/invoices/}")
    private String storagePath;

    @Value("${hms.billing.logo-path:logo.png}")
    private String logoPath;

    // Column X boundaries — same widths as PdfGenerationService for visual consistency
    private static final float[] COLS   = {50, 80, 145, 305, 340, 405, 465, 545};
    private static final float   ROW_H  = 20f;

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    public String generateGroupRoomRentPdf(GroupDoubleBillDto.GroupBillSectionDto section) {
        return generateGroupBillPdf(section);
    }

    public String generateGroupAncillaryPdf(GroupDoubleBillDto.GroupBillSectionDto section) {
        return generateGroupBillPdf(section);
    }

    // =========================================================================
    // CORE PDF GENERATION
    // =========================================================================

    private String generateGroupBillPdf(GroupDoubleBillDto.GroupBillSectionDto section) {
        ensureStorageDir();

        String fileName = "GRP_INV_" + section.invoiceNumber() + ".pdf";
        String fullPath = storagePath + fileName;

        try (PDDocument document = new PDDocument()) {
            // Body fonts: Open Sans
            PDFont fontRegular = loadFont(document, "fonts/OpenSans-Regular.ttf");
            PDFont fontBold    = loadFont(document, "fonts/OpenSans-Bold.ttf");
            PDFont fontOblique = loadFont(document, "fonts/OpenSans-Italic.ttf");
            // Luxury serif fonts: Cormorant Garamond (property title/address/GSTIN only)
            PDFont fontSerifRegular  = loadFont(document, "fonts/CormorantGaramond-Regular.ttf");
            PDFont fontSerifSemiBold = loadFont(document, "fonts/CormorantGaramond-SemiBold.ttf");

            PageState state = new PageState(document, fontBold, fontRegular, fontOblique);
            state.newPage();

            // Logo (proportional, 90pt max dimension)
            try (var logoStream = getClass().getClassLoader().getResourceAsStream("logo.png")) {
                if (logoStream != null) {
                    PDImageXObject logo  = PDImageXObject.createFromByteArray(document, logoStream.readAllBytes(), "logo");
                    float maxDim = 90f;
                    float scale  = Math.min(maxDim / logo.getWidth(), maxDim / logo.getHeight());
                    state.cs.drawImage(logo, 50, 730, logo.getWidth() * scale, logo.getHeight() * scale);
                }
            } catch (Exception ignored) {
                // Logo missing — continue without it
            }

            // Header band: property title+address centered | invoice block right-flush at x=455
            String propName = section.propertyName() != null ? section.propertyName() : "HOTEL INVOICE";
            drawTextCenter(state.cs, propName, 297.5f, 778, fontSerifSemiBold, 22);
            drawTextCenter(state.cs, section.propertyAddress() != null ? section.propertyAddress() : " ", 297.5f, 761, fontSerifRegular, 11);
            drawTextCenter(state.cs, "GSTIN: " + nvl(section.propertyGstNumber(), "N/A"), 297.5f, 746, fontSerifRegular, 11);

            String billType = "ROOM RENT".equals(section.category()) ? "ROOM RENT INVOICE" : "ANCILLARY INVOICE";
            drawText(state.cs, "GROUP " + billType,                                                                          455, 788, fontBold, 12);
            drawText(state.cs, "Invoice #: " + section.invoiceNumber(),                                                     455, 767, fontRegular, 10);
            drawText(state.cs, "Date: " + (section.invoiceDate() != null ? section.invoiceDate().format(DATE_FMT) : "N/A"), 455, 747, fontRegular, 10);

            // Bill To (left col x=50 | right col x=455 under invoice block)
            drawText(state.cs, "Bill To (Group Organizer):", 50, 685, fontBold, 11);

            // Left column: organizer details only
            drawText(state.cs, "Name:  " + nvl(section.organizerGuestName(),  "N/A"), 50, 670, fontRegular, 10);
            if (section.organizerGuestPhone() != null && !section.organizerGuestPhone().isBlank())
                drawText(state.cs, "Phone: " + section.organizerGuestPhone(), 50, 655, fontRegular, 10);
            if (section.organizerGuestEmail() != null && !section.organizerGuestEmail().isBlank())
                drawText(state.cs, "Email: " + section.organizerGuestEmail(), 50, 640, fontRegular, 10);
            if (section.organizerGuestGstNumber() != null && !section.organizerGuestGstNumber().isBlank()) {
                drawText(state.cs, "GSTIN: " + section.organizerGuestGstNumber(),     50, 625, fontRegular, 10);
            }

            // Right column: booking details aligned under invoice block
            drawText(state.cs, "Booking Details:", 455, 685, fontBold, 12);
            drawText(state.cs, "Group Ref: " + nvl(section.groupReference(), "N/A"),                                                    455, 670, fontRegular, 10);
            drawText(state.cs, "Check-In:  " + (section.checkIn()  != null ? section.checkIn().format(DATE_FMT)  : "N/A"),              455, 655, fontRegular, 10);
            drawText(state.cs, "Check-Out: " + (section.checkOut() != null ? section.checkOut().format(DATE_FMT) : "N/A"),              455, 640, fontRegular, 10);
            drawText(state.cs, "Rooms:     " + (section.rooms() != null ? section.rooms().size() : 0),                                  455, 625, fontRegular, 10);

            // Starting y for the charge table
            state.y = 555f;

            // ---- Per-room sections ----
            List<GroupDoubleBillDto.RoomChargeSection> rooms = section.rooms();
            if (rooms == null || rooms.isEmpty()) {
                drawText(state.cs, "No charges for this category.", 50, state.y - 20, fontOblique, 10);
            } else {
                int[] slNoHolder = {1};

                for (GroupDoubleBillDto.RoomChargeSection room : rooms) {
                    if (room.charges() == null || room.charges().isEmpty()) continue;

                    state.ensureSpace(ROW_H * 2 + 10);
                    drawRoomSectionHeader(state, room, fontBold, fontRegular);

                    state.ensureSpace(ROW_H);
                    drawTableHeader(state, fontBold);

                    for (ChargeDto charge : room.charges()) {
                        state.ensureSpace(ROW_H);
                        drawChargeRow(state, charge, slNoHolder[0]++, fontRegular);
                    }

                    state.ensureSpace(ROW_H);
                    drawRoomSubtotalRow(state, room, fontBold);

                    state.y -= 8; // gap between rooms
                }
            }

            // ---- Group totals ----
            state.ensureSpace(ROW_H * 6 + 10);
            drawGroupTotals(state, section, fontBold, fontRegular);

            // ---- Footer ----
            drawFooter(state, section, fontBold, fontOblique);

            if (state.cs != null) state.cs.close();

            document.save(new File(fullPath));
            return fullPath;

        } catch (IOException e) {
            throw new RuntimeException("Error generating group PDF invoice: " + e.getMessage(), e);
        }
    }

    // =========================================================================
    // DRAWING HELPERS
    // =========================================================================

    private void drawRoomSectionHeader(PageState state,
                                       GroupDoubleBillDto.RoomChargeSection room,
                                       PDFont fontBold, PDFont fontRegular) throws IOException {
        float y = state.y;

        state.cs.setNonStrokingColor(new Color(230, 230, 230));
        state.cs.addRect(COLS[0], y - ROW_H, COLS[7] - COLS[0], ROW_H);
        state.cs.fill();
        state.cs.setNonStrokingColor(Color.BLACK);

        String roomLabel = room.roomNumber() != null
                ? "Room " + room.roomNumber() + "  " + nvl(room.unitName(), "")
                : "Unit: " + nvl(room.unitName(), "N/A");
        drawText(state.cs, roomLabel, COLS[0] + 5, y - 13, fontBold, 10);
        drawText(state.cs, "Guest: " + nvl(room.guestName(), "N/A") + "  Folio: " + nvl(room.folioNumber(), "N/A"), COLS[3], y - 13, fontRegular, 9);

        state.cs.setLineWidth(0.5f);
        state.cs.moveTo(COLS[0], y - ROW_H);
        state.cs.lineTo(COLS[7], y - ROW_H);
        state.cs.stroke();

        state.y -= ROW_H;
    }

    private void drawTableHeader(PageState state, PDFont fontBold) throws IOException {
        float y = state.y;

        state.cs.setNonStrokingColor(HEADER_COLOR);
        state.cs.addRect(COLS[0], y - ROW_H, COLS[7] - COLS[0], ROW_H);
        state.cs.fill();
        state.cs.setNonStrokingColor(Color.WHITE);

        float textY = y - 14;
        drawText(state.cs, "Sl.",         COLS[0] + 5, textY, fontBold, 9);
        drawText(state.cs, "Date",        COLS[1] + 5, textY, fontBold, 9);
        drawText(state.cs, "Description", COLS[2] + 5, textY, fontBold, 9);
        drawTextRight(state.cs, "Qty",    COLS[4] - 5, textY, fontBold, 9);
        drawTextRight(state.cs, "Rate",   COLS[5] - 5, textY, fontBold, 9);
        drawTextRight(state.cs, "Tax",    COLS[6] - 5, textY, fontBold, 9);
        drawTextRight(state.cs, "Total",  COLS[7] - 5, textY, fontBold, 9);

        state.cs.setNonStrokingColor(Color.BLACK);
        state.cs.setLineWidth(0.5f);
        state.cs.moveTo(COLS[0], y);
        state.cs.lineTo(COLS[7], y);
        state.cs.stroke();
        state.cs.moveTo(COLS[0], y - ROW_H);
        state.cs.lineTo(COLS[7], y - ROW_H);
        state.cs.stroke();
        drawVerticalLines(state.cs, COLS, y, y - ROW_H);

        state.y -= ROW_H;
    }

    private void drawChargeRow(PageState state, ChargeDto charge, int slNo, PDFont fontRegular) throws IOException {
        float y = state.y;

        // Alternating row shading on even rows
        if (slNo % 2 == 0) {
            state.cs.setNonStrokingColor(new Color(248, 249, 250));
            state.cs.addRect(COLS[0], y - ROW_H, COLS[7] - COLS[0], ROW_H);
            state.cs.fill();
            state.cs.setNonStrokingColor(Color.BLACK);
        }

        String desc = nvl(charge.description(), " ");
        if (desc.length() > 32) desc = desc.substring(0, 29) + "...";

        float textY = y - 14;
        drawText(state.cs, String.valueOf(slNo), COLS[0] + 5, textY, fontRegular, 9);
        drawText(state.cs, charge.chargeDate() != null ? charge.chargeDate().format(DATE_FMT) : " ", COLS[1] + 5, textY, fontRegular, 9);
        drawText(state.cs, desc, COLS[2] + 5, textY, fontRegular, 9);
        drawTextRight(state.cs, fmt(charge.quantity()),    COLS[4] - 5, textY, fontRegular, 9);
        drawTextRight(state.cs, fmt2(charge.unitPrice()),  COLS[5] - 5, textY, fontRegular, 9);
        drawTextRight(state.cs, fmt2(charge.taxAmount()),  COLS[6] - 5, textY, fontRegular, 9);
        drawTextRight(state.cs, fmt2(charge.totalAmount()), COLS[7] - 5, textY, fontRegular, 9);

        state.cs.setLineWidth(0.5f);
        state.cs.moveTo(COLS[0], y - ROW_H);
        state.cs.lineTo(COLS[7], y - ROW_H);
        state.cs.stroke();
        drawVerticalLines(state.cs, COLS, y, y - ROW_H);

        state.y -= ROW_H;
    }

    private void drawRoomSubtotalRow(PageState state,
                                     GroupDoubleBillDto.RoomChargeSection room,
                                     PDFont fontBold) throws IOException {
        float y = state.y;

        state.cs.setNonStrokingColor(new Color(245, 245, 245));
        state.cs.addRect(COLS[0], y - ROW_H, COLS[7] - COLS[0], ROW_H);
        state.cs.fill();
        state.cs.setNonStrokingColor(Color.BLACK);

        String roomLabel = "Room Subtotal" + (room.roomNumber() != null ? " (" + room.roomNumber() + ")" : "");
        drawText(state.cs, roomLabel, COLS[2] + 5, y - 14, fontBold, 9);
        drawTextRight(state.cs, fmt2(room.subtotal()),    COLS[5] - 5, y - 14, fontBold, 9);
        drawTextRight(state.cs, fmt2(room.taxAmount()),   COLS[6] - 5, y - 14, fontBold, 9);
        drawTextRight(state.cs, fmt2(room.totalAmount()), COLS[7] - 5, y - 14, fontBold, 9);

        state.cs.setLineWidth(0.8f);
        state.cs.moveTo(COLS[0], y - ROW_H);
        state.cs.lineTo(COLS[7], y - ROW_H);
        state.cs.stroke();

        state.y -= ROW_H;
    }

    private void drawGroupTotals(PageState state,
                                 GroupDoubleBillDto.GroupBillSectionDto section,
                                 PDFont fontBold, PDFont fontRegular) throws IOException {
        float y = state.y - 10; // gap before totals block

        String[] labels = {"Subtotal", "Tax", "Grand Total", "Amount Paid", "Balance Due"};
        BigDecimal[] amounts = {
                nvlDec(section.groupSubtotal()),
                nvlDec(section.groupTaxAmount()),
                nvlDec(section.groupGrandTotal()),
                nvlDec(section.groupAmountPaid()),
                nvlDec(section.groupBalanceDue())
        };

        // Top border of full-width totals block
        state.cs.setLineWidth(0.5f);
        state.cs.moveTo(COLS[0], y);
        state.cs.lineTo(COLS[7], y);
        state.cs.stroke();

        for (int i = 0; i < labels.length; i++) {
            boolean isBold = (i == 2 || i == 4);
            PDFont f  = isBold ? fontBold : fontRegular;
            int    sz = isBold ? 11 : 10;

            // Light tint for Grand Total and Balance Due rows
            if (isBold) {
                state.cs.setNonStrokingColor(new Color(240, 244, 248));
                state.cs.addRect(COLS[0], y - ROW_H, COLS[7] - COLS[0], ROW_H);
                state.cs.fill();
                state.cs.setNonStrokingColor(Color.BLACK);
            }

            state.cs.setLineWidth(0.5f);
            state.cs.moveTo(COLS[0], y - ROW_H);
            state.cs.lineTo(COLS[7], y - ROW_H);
            state.cs.stroke();
            drawVerticalLines(state.cs, new float[]{COLS[0], COLS[6], COLS[7]}, y, y - ROW_H);

            drawTextRight(state.cs, labels[i], COLS[6] - 5, y - 14, fontBold, sz);
            drawTextRight(state.cs, fmt2(amounts[i]), COLS[7] - 5, y - 14, f, sz);

            y -= ROW_H;
        }

        state.y = y;
    }

    private void drawFooter(PageState state,
                            GroupDoubleBillDto.GroupBillSectionDto section,
                            PDFont fontBold, PDFont fontOblique) throws IOException {
        float y = state.y - 35; // generous padding below totals

        drawText(state.cs, "Balance Due (in words): " + convertToIndianCurrency(section.groupBalanceDue()),
                50, y, fontBold, 10);

        state.cs.setLineWidth(0.5f);
        state.cs.moveTo(50, y - 20);
        state.cs.lineTo(545, y - 20);
        state.cs.stroke();

        drawText(state.cs, "Thank you for choosing us!", 370, y - 38, fontBold, 10);
        drawText(state.cs, "This is a computer generated Group Invoice.", 50, y - 38, fontOblique, 10);
    }

    // =========================================================================
    // PAGE STATE
    // =========================================================================

    private class PageState {
        final PDDocument document;
        final PDFont fontBold;
        final PDFont fontRegular;
        final PDFont fontOblique;
        PDPageContentStream cs;
        float y;
        float tableTopY;

        PageState(PDDocument document, PDFont fontBold, PDFont fontRegular, PDFont fontOblique) {
            this.document    = document;
            this.fontBold    = fontBold;
            this.fontRegular = fontRegular;
            this.fontOblique = fontOblique;
        }

        void newPage() throws IOException {
            if (cs != null) cs.close();
            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            cs = new PDPageContentStream(document, page);
            cs.setLineWidth(0.5f);
            y = 780f;
            tableTopY = y;
        }

        void ensureSpace(float needed) throws IOException {
            if (y - needed < 100) newPage();
        }
    }

    // =========================================================================
    // UTILITY
    // =========================================================================

    private void ensureStorageDir() {
        try {
            Path path = Paths.get(storagePath);
            if (!Files.exists(path)) Files.createDirectories(path);
        } catch (IOException e) {
            throw new RuntimeException("Could not create invoice storage directory", e);
        }
    }

    private void drawText(PDPageContentStream cs, String text, float x, float y,
                          PDFont font, float fontSize) throws IOException {
        if (text == null) return;
        String safe = text.replace("\n", " ").replace("\r", " ").replaceAll("[^\\x00-\\x7F]", "");
        cs.setFont(font, fontSize);
        cs.beginText();
        cs.newLineAtOffset(x, y);
        cs.showText(safe);
        cs.endText();
    }

    private PDFont loadFont(PDDocument document, String classpathResource) {
        try (var stream = getClass().getClassLoader().getResourceAsStream(classpathResource)) {
            if (stream != null) return PDType0Font.load(document, stream);
        } catch (Exception ignored) {}
        return new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    }

    private void drawTextCenter(PDPageContentStream cs, String text, float centerX, float y,
                               PDFont font, float fontSize) throws IOException {
        if (text == null) return;
        String safe = text.replace("\n", " ").replace("\r", " ").replaceAll("[^\\x00-\\x7F]", "");
        float textWidth = font.getStringWidth(safe) / 1000 * fontSize;
        cs.setFont(font, fontSize);
        cs.beginText();
        cs.newLineAtOffset(centerX - textWidth / 2, y);
        cs.showText(safe);
        cs.endText();
    }

    private void drawTextRight(PDPageContentStream cs, String text, float rightX, float y,
                               PDFont font, float fontSize) throws IOException {
        if (text == null) return;
        String safe = text.replace("\n", " ").replace("\r", " ").replaceAll("[^\\x00-\\x7F]", "");
        float w = font.getStringWidth(safe) / 1000 * fontSize;
        cs.setFont(font, fontSize);
        cs.beginText();
        cs.newLineAtOffset(rightX - w, y);
        cs.showText(safe);
        cs.endText();
    }

    private void drawVerticalLines(PDPageContentStream cs, float[] cols,
                                   float topY, float bottomY) throws IOException {
        for (float x : cols) {
            cs.moveTo(x, topY);
            cs.lineTo(x, bottomY);
            cs.stroke();
        }
    }

    private String fmt(BigDecimal v) {
        if (v == null) return "0";
        return v.stripTrailingZeros().toPlainString();
    }

    private String fmt2(BigDecimal v) {
        if (v == null) return "0.00";
        return v.setScale(2, RoundingMode.HALF_UP).toString();
    }

    private String nvl(String s, String fallback) {
        return (s != null && !s.isBlank()) ? s : fallback;
    }

    private BigDecimal nvlDec(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    // =========================================================================
    // INDIAN CURRENCY WORDS
    // =========================================================================

    private static final String[] UNITS = {"", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"};
    private static final String[] TENS  = {"", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"};

    private String convertToIndianCurrency(BigDecimal amount) {
        if (amount == null) return "Zero Only";
        long rupees = amount.longValue();
        int paise   = amount.remainder(BigDecimal.ONE).multiply(new BigDecimal(100)).intValue();
        String rupeesPart = convertToWords(rupees).trim();
        if (rupeesPart.isEmpty()) rupeesPart = "Zero";
        String result = "Rupees " + rupeesPart;
        if (paise > 0) result += " and " + convertToWords(paise).trim() + " Paise";
        return result + " Only";
    }

    private String convertToWords(long n) {
        if (n == 0)       return "";
        if (n < 20)       return UNITS[(int) n];
        if (n < 100)      return TENS[(int)(n/10)] + ((n%10 != 0) ? " " : "") + UNITS[(int)(n%10)];
        if (n < 1000)     return UNITS[(int)(n/100)] + " Hundred" + ((n%100 != 0) ? " " : "") + convertToWords(n%100);
        if (n < 100000)   return convertToWords(n/1000)    + " Thousand" + ((n%1000 != 0)    ? " " : "") + convertToWords(n%1000);
        if (n < 10000000) return convertToWords(n/100000)  + " Lakh"     + ((n%100000 != 0)  ? " " : "") + convertToWords(n%100000);
        return                    convertToWords(n/10000000) + " Crore"   + ((n%10000000 != 0) ? " " : "") + convertToWords(n%10000000);
    }
}
