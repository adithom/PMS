package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.billing.bills.dto.BillDto;
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
import org.apache.pdfbox.pdmodel.graphics.state.PDExtendedGraphicsState;
import org.apache.pdfbox.util.Matrix;
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

@Service
public class PdfGenerationService {

    private static final Color HEADER_COLOR = new Color(33, 58, 90);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    @Value("${hms.billing.invoice-storage-path:./hms-data/invoices/}")
    private String storagePath;

    @Value("${hms.billing.logo-path:logo.png}")
    private String logoPath;

    public String generateInvoicePdf(BillDto billDto) {

        try {
            Path path = Paths.get(storagePath);
            if (!Files.exists(path)) {
                Files.createDirectories(path);
            }
        } catch (IOException e) {
            throw new RuntimeException("Could not create directory for invoices", e);
        }

        String fileName = "INV_" + billDto.invoiceNumber() + ".pdf";
        String fullPath = storagePath + fileName;

        try (PDDocument document = new PDDocument()) {

            // Body fonts: Open Sans
            PDFont fontRegular = loadFont(document, "fonts/OpenSans-Regular.ttf");
            PDFont fontBold    = loadFont(document, "fonts/OpenSans-Bold.ttf");
            PDFont fontOblique = loadFont(document, "fonts/OpenSans-Italic.ttf");
            // Luxury serif fonts: Cormorant Garamond (property title/address/GSTIN only)
            PDFont fontSerifRegular  = loadFont(document, "fonts/CormorantGaramond-Regular.ttf");
            PDFont fontSerifSemiBold = loadFont(document, "fonts/CormorantGaramond-SemiBold.ttf");

            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            PDPageContentStream contentStream = new PDPageContentStream(document, page);

            // --- 1. LOGO (proportional, 90pt max dimension) ---
            try (var logoStream = getClass().getClassLoader().getResourceAsStream("logo.png")) {
                if (logoStream != null) {
                    PDImageXObject pdImage = PDImageXObject.createFromByteArray(document, logoStream.readAllBytes(), "logo");
                    float maxDim = 90f;
                    float scale  = Math.min(maxDim / pdImage.getWidth(), maxDim / pdImage.getHeight());
                    contentStream.drawImage(pdImage, 50, 730, pdImage.getWidth() * scale, pdImage.getHeight() * scale);
                }
            } catch (Exception ignored) {
                // Logo missing — continue without it
            }

            // --- 2. HEADER BAND (logo left | property title+address center | invoice block right) ---
            // Property name: regular weight, centered on page (A4 center = 297.5)
            String propName = billDto.PropertyName() != null ? billDto.PropertyName() : "HOTEL INVOICE";
            drawTextCenter(contentStream, propName, 297.5f, 778, fontSerifSemiBold, 22);
            // Address and GSTIN: Cormorant Garamond regular, smaller, centered under title
            drawTextCenter(contentStream, billDto.PropertyAddress() != null ? billDto.PropertyAddress() : " ", 297.5f, 761, fontSerifRegular, 11);
            drawTextCenter(contentStream, "GSTIN: " + (billDto.gstNumber() != null ? billDto.gstNumber() : "N/A"), 297.5f, 746, fontSerifRegular, 11);

            // Invoice info block: right-flush at x=455, top aligned with logo top
            drawText(contentStream, "TAX INVOICE",                                     455, 788, fontBold, 12);
            drawText(contentStream, billDto.invoiceNumber(),                            455, 767, fontRegular, 10);
            drawText(contentStream, "Date: " + billDto.invoiceDate().format(DATE_FMT), 455, 747, fontRegular, 10);

            // --- 3. BILL TO (left col x=50 | right col x=455 under invoice block) ---
            drawText(contentStream, "Bill To:", 50, 685, fontBold, 12);

            // Left column: guest details only
            drawText(contentStream, "Name: " + billDto.guestName(), 50, 670, fontRegular, 10);
            if (billDto.guestPhone() != null && !billDto.guestPhone().isBlank())
                drawText(contentStream, "Phone: " + billDto.guestPhone(), 50, 655, fontRegular, 10);
            if (billDto.guestEmail() != null && !billDto.guestEmail().isBlank())
                drawText(contentStream, "Email: " + billDto.guestEmail(), 50, 640, fontRegular, 10);
            if (billDto.guestGstNumber() != null && !billDto.guestGstNumber().isEmpty()) {
                drawText(contentStream, "Guest GSTIN: " + billDto.guestGstNumber(), 50, 625, fontRegular, 10);
            }
            if (billDto.travelAgentName() != null && !billDto.travelAgentName().isBlank()) {
                drawText(contentStream, "Billed to Agent: " + billDto.travelAgentName(), 50, 610, fontBold, 10);
            }

            // Right column: booking details aligned under invoice block
            drawText(contentStream, "Booking Details:", 455, 685, fontBold, 12);
            drawText(contentStream, "Room: " + billDto.roomNumber(),                                                              455, 670, fontRegular, 10);
            drawText(contentStream, "Check-In: "  + (billDto.checkIn()  != null ? billDto.checkIn().format(DATE_FMT)  : "N/A"), 455, 655, fontRegular, 10);
            drawText(contentStream, "Check-Out: " + (billDto.checkOut() != null ? billDto.checkOut().format(DATE_FMT) : "N/A"), 455, 640, fontRegular, 10);

            // --- 4. CHARGES TABLE ---
            float yPosition = 555f;
            float rowHeight = 20f;
            float margin    = 50f;
            float titleRowHeight = 30f;

            float[] cols = {50, 80, 145, 305, 340, 405, 465, 545};

            // Bill type title (above the table; vertical lines do NOT extend into this row)
            String billTitle = "Invoice";
            try { billTitle = BillType.valueOf(billDto.category()).getDisplayLabel() + " Bill"; } catch (Exception ignored) {}
            contentStream.setNonStrokingColor(new Color(240, 244, 248));
            contentStream.addRect(cols[0], yPosition - titleRowHeight, cols[7] - cols[0], titleRowHeight);
            contentStream.fill();
            contentStream.setNonStrokingColor(new Color(33, 58, 90));
            drawText(contentStream, billTitle, cols[0] + 10, yPosition - 20, fontBold, 12);
            contentStream.setNonStrokingColor(Color.BLACK);
            contentStream.setLineWidth(0.5f);
            contentStream.moveTo(cols[0], yPosition);
            contentStream.lineTo(cols[0], yPosition - titleRowHeight);
            contentStream.stroke();
            contentStream.moveTo(cols[7], yPosition);
            contentStream.lineTo(cols[7], yPosition - titleRowHeight);
            contentStream.stroke();
            contentStream.moveTo(cols[0], yPosition - titleRowHeight);
            contentStream.lineTo(cols[7], yPosition - titleRowHeight);
            contentStream.stroke();
            yPosition -= titleRowHeight;

            // tableTopY is set after the title row so vertical lines only span the data table
            float tableTopY = yPosition;

            // Header background
            contentStream.setNonStrokingColor(HEADER_COLOR);
            contentStream.addRect(cols[0], yPosition - rowHeight, cols[7] - cols[0], rowHeight);
            contentStream.fill();
            contentStream.setNonStrokingColor(Color.WHITE);

            float textY = yPosition - 14;
            drawText(contentStream, "Sl.", cols[0] + 5, textY, fontBold, 10);
            drawText(contentStream, "Date", cols[1] + 5, textY, fontBold, 10);
            drawText(contentStream, "Description", cols[2] + 5, textY, fontBold, 10);
            drawTextRight(contentStream, "Qty",   cols[4] - 5, textY, fontBold, 10);
            drawTextRight(contentStream, "Rate",  cols[5] - 5, textY, fontBold, 10);
            drawTextRight(contentStream, "Tax",   cols[6] - 5, textY, fontBold, 10);
            drawTextRight(contentStream, "Total", cols[7] - 5, textY, fontBold, 10);

            contentStream.setNonStrokingColor(Color.BLACK);
            contentStream.setLineWidth(0.5f);

            contentStream.moveTo(cols[0], yPosition);
            contentStream.lineTo(cols[7], yPosition);
            contentStream.stroke();
            yPosition -= rowHeight;
            contentStream.moveTo(cols[0], yPosition);
            contentStream.lineTo(cols[7], yPosition);
            contentStream.stroke();

            // Items loop
            int slNo = 1;
            for (ChargeDto charge : billDto.charges()) {

                // Pagination
                if (yPosition < 200) {
                    drawVerticalLines(contentStream, cols, tableTopY, yPosition);
                    contentStream.close();

                    PDPage newPage = new PDPage(PDRectangle.A4);
                    document.addPage(newPage);
                    contentStream = new PDPageContentStream(document, newPage);
                    contentStream.setLineWidth(0.5f);

                    yPosition  = 780;
                    tableTopY  = yPosition;

                    contentStream.setNonStrokingColor(HEADER_COLOR);
                    contentStream.addRect(cols[0], yPosition - rowHeight, cols[7] - cols[0], rowHeight);
                    contentStream.fill();
                    contentStream.setNonStrokingColor(Color.WHITE);

                    textY = yPosition - 14;
                    drawText(contentStream, "Sl.", cols[0] + 5, textY, fontBold, 10);
                    drawText(contentStream, "Date", cols[1] + 5, textY, fontBold, 10);
                    drawText(contentStream, "Description", cols[2] + 5, textY, fontBold, 10);
                    drawTextRight(contentStream, "Qty",   cols[4] - 5, textY, fontBold, 10);
                    drawTextRight(contentStream, "Rate",  cols[5] - 5, textY, fontBold, 10);
                    drawTextRight(contentStream, "Tax",   cols[6] - 5, textY, fontBold, 10);
                    drawTextRight(contentStream, "Total", cols[7] - 5, textY, fontBold, 10);

                    contentStream.setNonStrokingColor(Color.BLACK);
                    contentStream.moveTo(cols[0], yPosition);
                    contentStream.lineTo(cols[7], yPosition);
                    contentStream.stroke();
                    yPosition -= rowHeight;
                    contentStream.moveTo(cols[0], yPosition);
                    contentStream.lineTo(cols[7], yPosition);
                    contentStream.stroke();
                }

                // Alternating row shading on even rows
                if (slNo % 2 == 0) {
                    contentStream.setNonStrokingColor(new Color(248, 249, 250));
                    contentStream.addRect(cols[0], yPosition - rowHeight, cols[7] - cols[0], rowHeight);
                    contentStream.fill();
                    contentStream.setNonStrokingColor(Color.BLACK);
                }

                String desc = charge.description() != null ? charge.description() : " ";
                if (desc.length() > 32) desc = desc.substring(0, 29) + "...";

                textY = yPosition - 14;
                drawText(contentStream, String.valueOf(slNo++), cols[0] + 5, textY, fontRegular, 9);
                drawText(contentStream, charge.chargeDate() != null ? charge.chargeDate().format(DATE_FMT) : " ", cols[1] + 5, textY, fontRegular, 9);
                drawText(contentStream, desc, cols[2] + 5, textY, fontRegular, 9);

                drawTextRight(contentStream, charge.quantity()    != null ? charge.quantity().stripTrailingZeros().toPlainString()        : "0",    cols[4] - 5, textY, fontRegular, 9);
                drawTextRight(contentStream, charge.unitPrice()   != null ? charge.unitPrice().setScale(2, RoundingMode.HALF_UP).toString()   : "0.00", cols[5] - 5, textY, fontRegular, 9);
                drawTextRight(contentStream, charge.taxAmount()   != null ? charge.taxAmount().setScale(2, RoundingMode.HALF_UP).toString()   : "0.00", cols[6] - 5, textY, fontRegular, 9);
                drawTextRight(contentStream, charge.totalAmount() != null ? charge.totalAmount().setScale(2, RoundingMode.HALF_UP).toString() : "0.00", cols[7] - 5, textY, fontRegular, 9);

                yPosition -= rowHeight;
                contentStream.moveTo(cols[0], yPosition);
                contentStream.lineTo(cols[7], yPosition);
                contentStream.stroke();
            }

            drawVerticalLines(contentStream, cols, tableTopY, yPosition);

            // --- 5. TOTALS SECTION (full page width) ---
            yPosition -= 8; // small gap between charge table and totals

            boolean isAgentBilled = billDto.travelAgentName() != null && !billDto.travelAgentName().isBlank()
                    && billDto.balanceDue() != null && billDto.balanceDue().compareTo(BigDecimal.ZERO) == 0;
            String[] labels = {"Subtotal", "Tax", "Grand Total", "Amount Paid", isAgentBilled ? "Billed to Agent" : "Balance Due"};
            String[] values = {
                    billDto.subtotal()   != null ? billDto.subtotal().setScale(2, RoundingMode.HALF_UP).toString()   : "0.00",
                    billDto.totalTax()   != null ? billDto.totalTax().setScale(2, RoundingMode.HALF_UP).toString()   : "0.00",
                    billDto.grandTotal() != null ? billDto.grandTotal().setScale(2, RoundingMode.HALF_UP).toString() : "0.00",
                    billDto.amountPaid() != null ? billDto.amountPaid().setScale(2, RoundingMode.HALF_UP).toString() : "0.00",
                    billDto.balanceDue() != null ? billDto.balanceDue().setScale(2, RoundingMode.HALF_UP).toString() : "0.00"
            };

            // Top border of totals block
            contentStream.setLineWidth(0.5f);
            contentStream.moveTo(cols[0], yPosition);
            contentStream.lineTo(cols[7], yPosition);
            contentStream.stroke();

            for (int i = 0; i < 5; i++) {
                if (yPosition < 150) {
                    contentStream.close();
                    PDPage newPage = new PDPage(PDRectangle.A4);
                    document.addPage(newPage);
                    contentStream = new PDPageContentStream(document, newPage);
                    contentStream.setLineWidth(0.5f);
                    yPosition = 780;
                }

                // Light tint for Grand Total and Balance Due rows
                if (i == 2 || i == 4) {
                    contentStream.setNonStrokingColor(new Color(240, 244, 248));
                    contentStream.addRect(cols[0], yPosition - rowHeight, cols[7] - cols[0], rowHeight);
                    contentStream.fill();
                    contentStream.setNonStrokingColor(Color.BLACK);
                }

                contentStream.moveTo(cols[0], yPosition - rowHeight);
                contentStream.lineTo(cols[7], yPosition - rowHeight);
                contentStream.stroke();

                // Full-width box: left wall | label separator | right wall
                float[] borderCols = {cols[0], cols[6], cols[7]};
                drawVerticalLines(contentStream, borderCols, yPosition, yPosition - rowHeight);

                PDFont f = (i == 2 || i == 4) ? fontBold : fontRegular;
                int    s = (i == 2 || i == 4) ? 11 : 10;

                drawTextRight(contentStream, labels[i], cols[6] - 5, yPosition - 14, fontBold, s);
                drawTextRight(contentStream, values[i], cols[7] - 5, yPosition - 14, f, s);

                yPosition -= rowHeight;
            }

            // --- 6. FOOTER ---
            String footerLabel = isAgentBilled
                    ? "Billed to Agent: " + billDto.travelAgentName()
                    : "Balance Due (in words): " + convertToIndianCurrency(billDto.balanceDue());
            drawText(contentStream, footerLabel, margin, yPosition - 35, fontBold, 10);

            contentStream.moveTo(margin, 130);
            contentStream.lineTo(545, 130);
            contentStream.stroke();

            drawText(contentStream, "Thank you for choosing us!", 400, 110, fontBold, 10);
            drawText(contentStream, "This is a computer generated Invoice.", margin, 110, fontOblique, 10);

            if (billDto.notes() != null && !billDto.notes().isBlank()) {
                drawText(contentStream, "Notes: " + billDto.notes(), margin, 95, fontOblique, 10);
            }

            contentStream.close();

            // --- 7. VOID WATERMARK ---
            if (billDto.isVoided()) {
                for (PDPage p : document.getPages()) {
                    try (PDPageContentStream wcs = new PDPageContentStream(
                            document, p, PDPageContentStream.AppendMode.APPEND, true, true)) {
                        PDExtendedGraphicsState gs = new PDExtendedGraphicsState();
                        gs.setNonStrokingAlphaConstant(0.12f);
                        wcs.saveGraphicsState();
                        wcs.setGraphicsStateParameters(gs);
                        wcs.setNonStrokingColor(new Color(220, 50, 50));
                        wcs.setFont(fontBold, 100);
                        wcs.beginText();
                        wcs.setTextMatrix(Matrix.getRotateInstance(Math.toRadians(45), 130, 200));
                        wcs.showText("VOID");
                        wcs.endText();
                        wcs.restoreGraphicsState();
                    }
                }
            }

            document.save(new File(fullPath));
            return fullPath;

        } catch (IOException e) {
            throw new RuntimeException("Error generating PDF invoice", e);
        }
    }

    // =========================================================================
    // HELPERS
    // =========================================================================

    private void drawText(PDPageContentStream stream, String text, float x, float y, PDFont font, float fontSize) throws IOException {
        if (text == null) return;
        String safeText = text.replace("\n", " ").replace("\r", " ").replaceAll("[^\\x00-\\x7F]", "");
        stream.setFont(font, fontSize);
        stream.beginText();
        stream.newLineAtOffset(x, y);
        stream.showText(safeText);
        stream.endText();
    }

    private PDFont loadFont(PDDocument document, String classpathResource) {
        try (var stream = getClass().getClassLoader().getResourceAsStream(classpathResource)) {
            if (stream != null) return PDType0Font.load(document, stream);
        } catch (Exception ignored) {}
        // Fallback to Helvetica if font file is missing
        return new PDType1Font(Standard14Fonts.FontName.HELVETICA);
    }

    private void drawTextCenter(PDPageContentStream stream, String text, float centerX, float y, PDFont font, float fontSize) throws IOException {
        if (text == null) return;
        String safeText = text.replace("\n", " ").replace("\r", " ").replaceAll("[^\\x00-\\x7F]", "");
        float textWidth = font.getStringWidth(safeText) / 1000 * fontSize;
        stream.setFont(font, fontSize);
        stream.beginText();
        stream.newLineAtOffset(centerX - textWidth / 2, y);
        stream.showText(safeText);
        stream.endText();
    }

    private void drawTextRight(PDPageContentStream stream, String text, float rightX, float y, PDFont font, float fontSize) throws IOException {
        if (text == null) return;
        String safeText = text.replace("\n", " ").replace("\r", " ").replaceAll("[^\\x00-\\x7F]", "");
        float textWidth = font.getStringWidth(safeText) / 1000 * fontSize;
        stream.setFont(font, fontSize);
        stream.beginText();
        stream.newLineAtOffset(rightX - textWidth, y);
        stream.showText(safeText);
        stream.endText();
    }

    private void drawVerticalLines(PDPageContentStream stream, float[] cols, float topY, float bottomY) throws IOException {
        for (float colX : cols) {
            stream.moveTo(colX, topY);
            stream.lineTo(colX, bottomY);
            stream.stroke();
        }
    }

    // =========================================================================
    // INDIAN CURRENCY WORDS
    // =========================================================================

    private static final String[] units = {"", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"};
    private static final String[] tens  = {"", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"};

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

    private String convertToWords(long number) {
        if (number == 0) return "";
        if (number < 20)       return units[(int) number];
        if (number < 100)      return tens[(int)(number/10)] + ((number%10 != 0) ? " " : "") + units[(int)(number%10)];
        if (number < 1000)     return units[(int)(number/100)] + " Hundred" + ((number%100 != 0) ? " " : "") + convertToWords(number%100);
        if (number < 100000)   return convertToWords(number/1000)    + " Thousand" + ((number%1000 != 0)    ? " " : "") + convertToWords(number%1000);
        if (number < 10000000) return convertToWords(number/100000)  + " Lakh"     + ((number%100000 != 0)  ? " " : "") + convertToWords(number%100000);
        return                        convertToWords(number/10000000) + " Crore"    + ((number%10000000 != 0) ? " " : "") + convertToWords(number%10000000);
    }
}
