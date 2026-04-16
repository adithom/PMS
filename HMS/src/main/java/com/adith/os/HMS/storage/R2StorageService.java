package com.adith.os.HMS.storage;

import com.adith.os.HMS.config.R2Config;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;

@Service
public class R2StorageService {

    private static final Logger log = LoggerFactory.getLogger(R2StorageService.class);

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final R2Config r2Config;

    @Value("${cloudflare.r2.bucket-name}")
    private String bucketName;

    @Value("${cloudflare.r2.presigned-url-expiry-minutes:60}")
    private long presignedUrlExpiryMinutes;

    public R2StorageService(S3Client r2S3Client, S3Presigner r2S3Presigner, R2Config r2Config) {
        this.s3Client = r2S3Client;
        this.s3Presigner = r2S3Presigner;
        this.r2Config = r2Config;
    }

    public boolean isConfigured() {
        return r2Config.isConfigured();
    }

    /**
     * Uploads the file at localFilePath to R2 under the given objectKey.
     * Returns the objectKey (to be persisted in the DB as pdfFilePath).
     *
     * @throws R2UploadException on any upload failure
     */
    public String uploadPdf(Path localFilePath, String objectKey) {
        try {
            byte[] bytes = Files.readAllBytes(localFilePath);
            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(objectKey)
                    .contentType("application/pdf")
                    .build();
            s3Client.putObject(putRequest, RequestBody.fromBytes(bytes));
            log.info("Uploaded PDF to R2: bucket={} key={}", bucketName, objectKey);
            return objectKey;
        } catch (IOException | S3Exception e) {
            throw new R2UploadException("Failed to upload PDF to R2: " + objectKey, e);
        }
    }

    /**
     * Generates a pre-signed GET URL for the given R2 object key.
     * The Content-Disposition: attachment header is set so the browser
     * triggers a file download rather than opening the PDF inline.
     *
     * @param objectKey the R2 key (stored in bill.pdfFilePath)
     * @param fileName  the suggested download filename for the browser
     * @return a pre-signed URL string valid for presignedUrlExpiryMinutes
     */
    public String generatePresignedDownloadUrl(String objectKey, String fileName) {
        GetObjectRequest getRequest = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(objectKey)
                .responseContentDisposition("attachment; filename=\"" + fileName + "\"")
                .build();

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(presignedUrlExpiryMinutes))
                .getObjectRequest(getRequest)
                .build();

        PresignedGetObjectRequest presigned = s3Presigner.presignGetObject(presignRequest);
        return presigned.url().toString();
    }

    /**
     * Downloads an object from R2 and returns its raw bytes.
     * Used for bulk ZIP packaging.
     */
    public byte[] downloadObjectAsBytes(String objectKey) {
        GetObjectRequest req = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(objectKey)
                .build();
        ResponseBytes<GetObjectResponse> result = s3Client.getObjectAsBytes(req);
        return result.asByteArray();
    }
}
