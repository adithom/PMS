package com.adith.os.HMS.billing.bills;

import com.adith.os.HMS.billing.bills.dto.BillDto;
import com.adith.os.HMS.billing.folio.dto.ChargeDto;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
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

@Service
public class PdfGenerationService {

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
        DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("dd-MM-yyyy");

        try (PDDocument document = new PDDocument()) {

            PDFont fontBold = new PDType1Font(Standard14Fonts.FontName.HELVETICA_BOLD);
            PDFont fontRegular = new PDType1Font(Standard14Fonts.FontName.HELVETICA);
            PDFont fontOblique = new PDType1Font(Standard14Fonts.FontName.HELVETICA_OBLIQUE);

            PDPage page = new PDPage(PDRectangle.A4);
            document.addPage(page);
            PDPageContentStream contentStream = new PDPageContentStream(document, page);

            // --- 1. LOGO ---
            File logoFile = new File(logoPath);
            if (logoFile.exists()) {
                PDImageXObject pdImage = PDImageXObject.createFromFile(logoFile.getAbsolutePath(), document);
                contentStream.drawImage(pdImage, 50, 750, 80, 50);
            }

            // --- 2. HEADER INFO ---
            drawText(contentStream, billDto.PropertyName() != null ? billDto.PropertyName() : "HOTEL INVOICE", 50, 720, fontBold, 18);
            drawText(contentStream, billDto.PropertyAddress() != null ? billDto.PropertyAddress() : " ", 50, 705, fontRegular, 10);
            drawText(contentStream, "GSTIN: " + (billDto.gstNumber() != null ? billDto.gstNumber() : "N/A"), 50, 690, fontRegular, 10);

            drawText(contentStream, "TAX INVOICE", 400, 720, fontBold, 14);
            drawText(contentStream, "Invoice #: " + billDto.invoiceNumber(), 400, 700, fontRegular, 10);
            drawText(contentStream, "Date: " + billDto.invoiceDate().format(dateFormatter), 400, 685, fontRegular, 10);

            // --- 3. GUEST INFO ---
            drawText(contentStream, "Bill To:", 50, 640, fontBold, 12);
            drawText(contentStream, "Name: " + billDto.guestName(), 50, 625, fontRegular, 10);
            drawText(contentStream, "Phone: " + billDto.guestPhone(), 50, 610, fontRegular, 10);
            drawText(contentStream, "Email: " + (billDto.guestEmail() != null ? billDto.guestEmail() : " "), 50, 595, fontRegular, 10);

            float rightColY = 625;
            if (billDto.guestGstNumber() != null && !billDto.guestGstNumber().isEmpty()) {
                drawText(contentStream, "Guest GSTIN: " + billDto.guestGstNumber(), 50, 580, fontRegular, 10);
                rightColY = 610;
            }

            drawText(contentStream, "Room: " + billDto.roomNumber(), 350, rightColY, fontRegular, 10);
            drawText(contentStream, "Check-In: " + (billDto.checkIn() != null ? billDto.checkIn().format(dateFormatter) : "N/A"), 350, rightColY - 15, fontRegular, 10);
            drawText(contentStream, "Check-Out: " + (billDto.checkOut() != null ? billDto.checkOut().format(dateFormatter) : "N/A"), 350, rightColY - 30, fontRegular, 10);

            // --- 4. BEAUTIFUL NATIVE TABLE ---
            float yStart = 540;
            float yPosition = yStart;
            float rowHeight = 20f;
            float margin = 50;

            // X coordinates for column boundaries (Total width = 495)
            float[] cols = {50, 80, 145, 305, 340, 405, 465, 545};
            float tableTopY = yPosition;

            // Header Background
            contentStream.setNonStrokingColor(Color.DARK_GRAY);
            contentStream.addRect(cols[0], yPosition - rowHeight, cols[7] - cols[0], rowHeight);
            contentStream.fill();
            contentStream.setNonStrokingColor(Color.WHITE);

            // Header Text (Numbers are right aligned to column boundaries!)
            float textY = yPosition - 14;
            drawText(contentStream, "Sl.", cols[0] + 5, textY, fontBold, 10);
            drawText(contentStream, "Date", cols[1] + 5, textY, fontBold, 10);
            drawText(contentStream, "Description", cols[2] + 5, textY, fontBold, 10);
            drawTextRight(contentStream, "Qty", cols[4] - 5, textY, fontBold, 10);
            drawTextRight(contentStream, "Rate", cols[5] - 5, textY, fontBold, 10);
            drawTextRight(contentStream, "Tax", cols[6] - 5, textY, fontBold, 10);
            drawTextRight(contentStream, "Total", cols[7] - 5, textY, fontBold, 10);

            contentStream.setNonStrokingColor(Color.BLACK);
            contentStream.setLineWidth(0.5f);

            // Header Lines
            contentStream.moveTo(cols[0], yPosition);
            contentStream.lineTo(cols[7], yPosition);
            contentStream.stroke();
            yPosition -= rowHeight;
            contentStream.moveTo(cols[0], yPosition);
            contentStream.lineTo(cols[7], yPosition);
            contentStream.stroke();

            // Items Loop
            int slNo = 1;
            for (ChargeDto charge : billDto.charges()) {

                // Pagination: Create new page if hitting the bottom
                if (yPosition < 200) {
                    drawVerticalLines(contentStream, cols, tableTopY, yPosition);
                    contentStream.close();

                    PDPage newPage = new PDPage(PDRectangle.A4);
                    document.addPage(newPage);
                    contentStream = new PDPageContentStream(document, newPage);
                    contentStream.setLineWidth(0.5f);

                    yPosition = 780;
                    tableTopY = yPosition;

                    // Re-draw Header on new page
                    contentStream.setNonStrokingColor(Color.DARK_GRAY);
                    contentStream.addRect(cols[0], yPosition - rowHeight, cols[7] - cols[0], rowHeight);
                    contentStream.fill();
                    contentStream.setNonStrokingColor(Color.WHITE);

                    textY = yPosition - 14;
                    drawText(contentStream, "Sl.", cols[0] + 5, textY, fontBold, 10);
                    drawText(contentStream, "Date", cols[1] + 5, textY, fontBold, 10);
                    drawText(contentStream, "Description", cols[2] + 5, textY, fontBold, 10);
                    drawTextRight(contentStream, "Qty", cols[4] - 5, textY, fontBold, 10);
                    drawTextRight(contentStream, "Rate", cols[5] - 5, textY, fontBold, 10);
                    drawTextRight(contentStream, "Tax", cols[6] - 5, textY, fontBold, 10);
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

                // Truncate descriptions to prevent bleeding
                String desc = charge.description() != null ? charge.description() : " ";
                if (desc.length() > 32) desc = desc.substring(0, 29) + "...";

                textY = yPosition - 14;
                drawText(contentStream, String.valueOf(slNo++), cols[0] + 5, textY, fontRegular, 9);
                drawText(contentStream, charge.chargeDate() != null ? charge.chargeDate().format(dateFormatter) : " ", cols[1] + 5, textY, fontRegular, 9);
                drawText(contentStream, desc, cols[2] + 5, textY, fontRegular, 9);

                drawTextRight(contentStream, charge.quantity() != null ? charge.quantity().stripTrailingZeros().toPlainString() : "0", cols[4] - 5, textY, fontRegular, 9);
                drawTextRight(contentStream, charge.unitPrice() != null ? charge.unitPrice().setScale(2, RoundingMode.HALF_UP).toString() : "0.00", cols[5] - 5, textY, fontRegular, 9);
                drawTextRight(contentStream, charge.taxAmount() != null ? charge.taxAmount().setScale(2, RoundingMode.HALF_UP).toString() : "0.00", cols[6] - 5, textY, fontRegular, 9);
                drawTextRight(contentStream, charge.totalAmount() != null ? charge.totalAmount().setScale(2, RoundingMode.HALF_UP).toString() : "0.00", cols[7] - 5, textY, fontRegular, 9);

                yPosition -= rowHeight;
                contentStream.moveTo(cols[0], yPosition);
                contentStream.lineTo(cols[7], yPosition);
                contentStream.stroke();
            }

            // Draw vertical grid lines for the items
            drawVerticalLines(contentStream, cols, tableTopY, yPosition);

            // --- 5. TOTALS SECTION (Boxed perfectly) ---
            String[] labels = {"Subtotal", "Tax", "Grand Total", "Amount Paid", "Balance Due"};
            String[] values = {
                    billDto.subtotal() != null ? billDto.subtotal().setScale(2, RoundingMode.HALF_UP).toString() : "0.00",
                    billDto.totalTax() != null ? billDto.totalTax().setScale(2, RoundingMode.HALF_UP).toString() : "0.00",
                    billDto.grandTotal() != null ? billDto.grandTotal().setScale(2, RoundingMode.HALF_UP).toString() : "0.00",
                    billDto.amountPaid() != null ? billDto.amountPaid().setScale(2, RoundingMode.HALF_UP).toString() : "0.00",
                    billDto.balanceDue() != null ? billDto.balanceDue().setScale(2, RoundingMode.HALF_UP).toString() : "0.00"
            };

            for (int i = 0; i < 5; i++) {
                if (yPosition < 150) {
                    contentStream.close();
                    PDPage newPage = new PDPage(PDRectangle.A4);
                    document.addPage(newPage);
                    contentStream = new PDPageContentStream(document, newPage);
                    contentStream.setLineWidth(0.5f);
                    yPosition = 780;
                }

                contentStream.moveTo(cols[0], yPosition - rowHeight);
                contentStream.lineTo(cols[7], yPosition - rowHeight);
                contentStream.stroke();

                // Draw left boundary, inner separator, right boundary
                float[] borderCols = {cols[0], cols[6], cols[7]};
                drawVerticalLines(contentStream, borderCols, yPosition, yPosition - rowHeight);

                // Index 2 is Grand Total, Index 4 is Balance Due. Both get Bold and larger text.
                PDFont f = (i == 2 || i == 4) ? fontBold : fontRegular;
                int s = (i == 2 || i == 4) ? 11 : 10;

                drawTextRight(contentStream, labels[i], cols[6] - 5, yPosition - 14, fontBold, s);
                drawTextRight(contentStream, values[i], cols[7] - 5, yPosition - 14, f, s);

                yPosition -= rowHeight;
            }

            // --- 6. FOOTER ---
            // Changed to correctly show "Balance Due" in words
            drawText(contentStream, "Balance Due (in words): " + convertToIndianCurrency(billDto.balanceDue()), margin, yPosition - 25, fontBold, 10);

            // Fixed bottom footer lines
            contentStream.moveTo(margin, 130);
            contentStream.lineTo(545, 130);
            contentStream.stroke();

            drawText(contentStream, "Thank you for your business!", 400, 110, fontBold, 10);
            drawText(contentStream, "This is a computer generated Invoice.", margin, 110, fontOblique, 10);

            if (billDto.notes() != null && !billDto.notes().isBlank()) {
                drawText(contentStream, "Notes: " + billDto.notes(), margin, 95, fontOblique, 10);
            }

            contentStream.close();
            document.save(new File(fullPath));
            return fullPath;

        } catch (IOException e) {
            throw new RuntimeException("Error generating PDF invoice", e);
        }
    }

    // =========================================================================
    // NATIVE PDFBOX HELPERS (Right Align, Truncate, Strip Invalid Chars)
    // =========================================================================

    private void drawText(PDPageContentStream stream, String text, float x, float y, PDFont font, float fontSize) throws IOException {
        if (text == null) return;
        // Strip out emojis or non-ASCII characters to guarantee no crashes on standard Helvetica
        String safeText = text.replace("\n", " ").replace("\r", " ").replaceAll("[^\\x00-\\x7F]", "");
        stream.setFont(font, fontSize);
        stream.beginText();
        stream.newLineAtOffset(x, y);
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
    // INDIAN CURRENCY WORDS CONVERSION
    // =========================================================================

    private static final String[] units = { "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen" };
    private static final String[] tens = { "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety" };

    private String convertToIndianCurrency(BigDecimal amount) {
        if (amount == null) return "Zero Only";
        long rupees = amount.longValue();
        int paise = amount.remainder(BigDecimal.ONE).multiply(new BigDecimal(100)).intValue();

        String rupeesPart = convertToWords(rupees).trim();
        if (rupeesPart.isEmpty()) {
            rupeesPart = "Zero";
        }

        String result = "Rupees " + rupeesPart;
        if (paise > 0) {
            result += " and " + convertToWords(paise).trim() + " Paise";
        }
        return result + " Only";
    }

    private String convertToWords(long number) {
        if (number == 0) return "";
        if (number < 20) return units[(int) number];
        if (number < 100) return tens[(int) (number / 10)] + ((number % 10 != 0) ? " " : "") + units[(int) (number % 10)];
        if (number < 1000) return units[(int) (number / 100)] + " Hundred" + ((number % 100 != 0) ? " " : "") + convertToWords(number % 100);
        if (number < 100000) return convertToWords(number / 1000) + " Thousand" + ((number % 1000 != 0) ? " " : "") + convertToWords(number % 1000);
        if (number < 10000000) return convertToWords(number / 100000) + " Lakh" + ((number % 100000 != 0) ? " " : "") + convertToWords(number % 100000);
        return convertToWords(number / 10000000) + " Crore" + ((number % 10000000 != 0) ? " " : "") + convertToWords(number % 10000000);
    }
}
