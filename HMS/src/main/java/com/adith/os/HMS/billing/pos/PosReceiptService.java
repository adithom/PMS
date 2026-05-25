package com.adith.os.HMS.billing.pos;

import jakarta.transaction.Transactional;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.pdmodel.font.PDType0Font;
import org.apache.pdfbox.pdmodel.graphics.image.PDImageXObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.awt.Color;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
public class PosReceiptService {

    private static final Color HEADER_COLOR = new Color(33, 58, 90);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DT_FMT   = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    @Value("${hms.billing.invoice-storage-path:./hms-data/invoices/}")
    private String storagePath;

    private final PosReceiptSequenceRepository sequenceRepository;
    private final PosLocationRepository locationRepository;

    public PosReceiptService(PosReceiptSequenceRepository sequenceRepository,
                             PosLocationRepository locationRepository) {
        this.sequenceRepository = sequenceRepository;
        this.locationRepository = locationRepository;
    }

    @Transactional
    public String getNextInvoiceNumber(PosLocation location) {
        int month = LocalDate.now().getMonthValue();
        int year  = LocalDate.now().getYear();
        int financialYear = (month >= 4) ? year : year - 1;

        PosReceiptSequence seq = sequenceRepository
                .findByLocationAndYearForUpdate(location.getId(), financialYear)
                .orElseGet(() -> {
                    PosReceiptSequence s = new PosReceiptSequence();
                    s.setPosLocation(location);
                    s.setFinancialYear(financialYear);
                    s.setLastSequenceNumber(0);
                    return sequenceRepository.save(s);
                });

        seq.setLastSequenceNumber(seq.getLastSequenceNumber() + 1);
        sequenceRepository.save(seq);

        String prefix = location.getLocationType().getInvoicePrefix();
        return String.format("%s%06d", prefix, seq.getLastSequenceNumber());
    }

    public String generateReceipt(PosTicket ticket) {
        try {
            var path = Paths.get(storagePath);
            if (!Files.exists(path)) {
                Files.createDirectories(path);
            }
        } catch (IOException e) {
            throw new RuntimeException("Could not create invoice directory", e);
        }

        String invoiceNumber = ticket.getInvoiceNumber();
        String fileName = "INV_" + invoiceNumber + ".pdf";
        String fullPath = storagePath + fileName;

        // Collect all items across all orders in this ticket
        List<PosOrder> orders = ticket.getOrders();

        BigDecimal totalSubtotal = BigDecimal.ZERO;
        BigDecimal totalTax      = BigDecimal.ZERO;
        BigDecimal grandTotal    = BigDecimal.ZERO;

        for (PosOrder order : orders) {
            totalSubtotal = totalSubtotal.add(order.getSubtotal());
            totalTax      = totalTax.add(order.getTaxAmount());
            grandTotal    = grandTotal.add(order.getTotalAmount());
        }

        try (PDDocument doc = new PDDocument()) {
            PDFont fontRegular  = loadFont(doc, "fonts/OpenSans-Regular.ttf");
            PDFont fontBold     = loadFont(doc, "fonts/OpenSans-Bold.ttf");
            PDFont fontSerif    = loadFont(doc, "fonts/CormorantGaramond-SemiBold.ttf");
            PDFont fontSerifReg = loadFont(doc, "fonts/CormorantGaramond-Regular.ttf");

            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);
            PDPageContentStream cs = new PDPageContentStream(doc, page);

            // --- Logo ---
            try (var logoStream = getClass().getClassLoader().getResourceAsStream("logo.png")) {
                if (logoStream != null) {
                    PDImageXObject img = PDImageXObject.createFromByteArray(doc, logoStream.readAllBytes(), "logo");
                    float maxDim = 90f;
                    float scale  = Math.min(maxDim / img.getWidth(), maxDim / img.getHeight());
                    cs.drawImage(img, 50, 730, img.getWidth() * scale, img.getHeight() * scale);
                }
            } catch (Exception ignored) {}

            // --- Property name / address / GSTIN (centered) ---
            String propName = ticket.getProperty().getName() != null
                    ? ticket.getProperty().getName() : "Property";
            drawTextCenter(cs, propName, 297.5f, 778, fontSerif, 22);

            // Address block — running y cursor, 16pt gaps
            float addrY = 761f;
            final float addrGap = 13f;
            String propAddress = ticket.getProperty().getAddress();
            if (propAddress != null && !propAddress.isBlank()) {
                drawTextCenter(cs, propAddress, 297.5f, addrY, fontSerifReg, 11);
            }
            StringBuilder posLine2 = new StringBuilder();
            String posAddrLine2 = ticket.getProperty().getAddressLine2();
            String posPostal    = ticket.getProperty().getPostalCode();
            if (posAddrLine2 != null && !posAddrLine2.isBlank()) posLine2.append(posAddrLine2);
            if (posPostal != null && !posPostal.isBlank()) {
                if (posLine2.length() > 0) posLine2.append(" - ");
                posLine2.append(posPostal);
            }
            if (posLine2.length() > 0) {
                addrY -= addrGap;
                drawTextCenter(cs, posLine2.toString(), 297.5f, addrY, fontSerifReg, 11);
            }
            String posPhone = ticket.getProperty().getPhone();
            if (posPhone != null && !posPhone.isBlank()) {
                addrY -= addrGap;
                drawTextCenter(cs, posPhone, 297.5f, addrY, fontSerifReg, 11);
            }
            String gstin = ticket.getProperty().getGstNumber();
            drawTextCenter(cs, "GSTIN: " + (gstin != null ? gstin : "N/A"), 297.5f, 746, fontSerifReg, 11);

            // --- Receipt number + date (right side, no "TAX INVOICE" label) ---
            String closedAt = ticket.getClosedAt() != null
                    ? ticket.getClosedAt().format(DT_FMT) : LocalDate.now().format(DATE_FMT);
            drawText(cs, "Receipt No: " + invoiceNumber, 455, 788, fontBold, 10);
            drawText(cs, "Date: " + closedAt,            455, 767, fontRegular, 10);

            // --- Bill To section ---
            drawText(cs, "Bill To:", 50, 685, fontBold, 12);
            drawText(cs, "Guest: " + (ticket.getGuestName() != null ? ticket.getGuestName() : "Walk-in"),
                    50, 670, fontRegular, 10);

            drawText(cs, "Details:", 455, 685, fontBold, 12);
            if (ticket.getRoomNumber() != null) {
                drawText(cs, "Room: " + ticket.getRoomNumber(), 455, 670, fontRegular, 10);
            }
            drawText(cs, "Meal: " + ticket.getMealType().name(),
                    455, ticket.getRoomNumber() != null ? 655 : 670, fontRegular, 10);

            // --- Section title row (location name + "Bill") ---
            float y = 610f;
            float rowH = 18f;
            float titleRowH = 26f;

            String locationName = ticket.getPosLocation() != null && ticket.getPosLocation().getName() != null
                    ? ticket.getPosLocation().getName() : "POS";
            String sectionTitle = locationName + " Bill";

            cs.setNonStrokingColor(new Color(240, 244, 248));
            cs.addRect(50, y - titleRowH, 495, titleRowH);
            cs.fill();
            cs.setNonStrokingColor(new Color(33, 58, 90));
            drawText(cs, sectionTitle, 60, y - 18, fontBold, 10);
            cs.setNonStrokingColor(Color.BLACK);
            cs.setLineWidth(0.5f);
            cs.moveTo(50, y); cs.lineTo(545, y); cs.stroke();
            cs.moveTo(50, y - titleRowH); cs.lineTo(545, y - titleRowH); cs.stroke();
            cs.moveTo(50, y); cs.lineTo(50, y - titleRowH); cs.stroke();
            cs.moveTo(545, y); cs.lineTo(545, y - titleRowH); cs.stroke();
            y -= titleRowH;

            // --- Items table header ---
            cs.setNonStrokingColor(HEADER_COLOR);
            cs.addRect(50, y - rowH, 495, rowH);
            cs.fill();
            cs.setNonStrokingColor(Color.WHITE);

            float textY = y - 13;
            drawText(cs, "Item",       55,  textY, fontBold, 9);
            drawTextRight(cs, "Qty",   280, textY, fontBold, 9);
            drawTextRight(cs, "Rate",  360, textY, fontBold, 9);
            drawTextRight(cs, "Tax",   440, textY, fontBold, 9);
            drawTextRight(cs, "Total", 545, textY, fontBold, 9);

            cs.setNonStrokingColor(Color.BLACK);
            y -= rowH;

            // --- Items rows ---
            int rowIdx = 0;
            for (PosOrder order : orders) {
                for (PosOrderItem item : order.getItems()) {
                    if (y < 150) {
                        cs.close();
                        PDPage newPage = new PDPage(PDRectangle.A4);
                        doc.addPage(newPage);
                        cs = new PDPageContentStream(doc, newPage);
                        y = 780f;
                    }
                    if (rowIdx % 2 == 0) {
                        cs.setNonStrokingColor(new Color(248, 249, 250));
                        cs.addRect(50, y - rowH, 495, rowH);
                        cs.fill();
                        cs.setNonStrokingColor(Color.BLACK);
                    }
                    textY = y - 13;
                    String itemName = item.getItemName() != null ? item.getItemName() : "";
                    if (itemName.length() > 30) itemName = itemName.substring(0, 27) + "...";
                    drawText(cs, itemName, 55, textY, fontRegular, 9);
                    drawTextRight(cs, String.valueOf(item.getQuantity()),                                      280, textY, fontRegular, 9);
                    drawTextRight(cs, fmt(item.getUnitPrice()),                                               360, textY, fontRegular, 9);
                    drawTextRight(cs, fmt(item.getTaxAmount()),                                               440, textY, fontRegular, 9);
                    drawTextRight(cs, fmt(item.getTotalAmount()),                                             545, textY, fontRegular, 9);

                    cs.setLineWidth(0.3f);
                    cs.moveTo(50, y - rowH); cs.lineTo(545, y - rowH); cs.stroke();
                    y -= rowH;
                    rowIdx++;
                }
            }

            // --- Totals ---
            y -= 4;
            cs.setLineWidth(0.5f);
            cs.moveTo(50, y); cs.lineTo(545, y); cs.stroke();

            y = drawTotalRow(cs, "Subtotal",  fmt(totalSubtotal), y, rowH, fontRegular, fontBold, false);
            y = drawTotalRow(cs, "Tax",        fmt(totalTax),      y, rowH, fontRegular, fontBold, false);
            y = drawTotalRow(cs, "Grand Total", fmt(grandTotal),   y, rowH, fontRegular, fontBold, true);

            // --- Footer ---
            y -= 20;
            drawTextCenter(cs, "Thank you for dining with us!", 297.5f, y, fontRegular, 10);

            cs.close();
            doc.save(fullPath);

        } catch (IOException e) {
            throw new RuntimeException("Receipt PDF generation failed", e);
        }

        return fullPath;
    }

    // ──────────────── Helpers ────────────────

    private float drawTotalRow(PDPageContentStream cs, String label, String value,
                               float y, float rowH, PDFont regular, PDFont bold,
                               boolean highlight) throws IOException {
        if (highlight) {
            cs.setNonStrokingColor(new Color(240, 244, 248));
            cs.addRect(50, y - rowH, 495, rowH);
            cs.fill();
            cs.setNonStrokingColor(Color.BLACK);
        }
        drawText(cs, label, 380, y - 13, highlight ? bold : regular, 9);
        drawTextRight(cs, value, 545, y - 13, highlight ? bold : regular, 9);
        cs.setLineWidth(0.3f);
        cs.moveTo(50, y - rowH); cs.lineTo(545, y - rowH); cs.stroke();
        return y - rowH;
    }

    private PDFont loadFont(PDDocument doc, String resource) throws IOException {
        try (var stream = getClass().getClassLoader().getResourceAsStream(resource)) {
            if (stream == null) throw new IOException("Font not found: " + resource);
            return PDType0Font.load(doc, stream);
        }
    }

    private void drawText(PDPageContentStream cs, String text, float x, float y,
                          PDFont font, float size) throws IOException {
        cs.beginText();
        cs.setFont(font, size);
        cs.newLineAtOffset(x, y);
        cs.showText(text != null ? text : "");
        cs.endText();
    }

    private void drawTextCenter(PDPageContentStream cs, String text, float cx, float y,
                                PDFont font, float size) throws IOException {
        float width = font.getStringWidth(text) / 1000 * size;
        drawText(cs, text, cx - width / 2, y, font, size);
    }

    private void drawTextRight(PDPageContentStream cs, String text, float rightX, float y,
                               PDFont font, float size) throws IOException {
        float width = font.getStringWidth(text) / 1000 * size;
        drawText(cs, text, rightX - width, y, font, size);
    }

    private String fmt(BigDecimal v) {
        return v != null ? v.setScale(2, RoundingMode.HALF_UP).toPlainString() : "0.00";
    }
}
