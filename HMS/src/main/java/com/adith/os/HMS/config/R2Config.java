package com.adith.os.HMS.config;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

import java.net.URI;

@Configuration
public class R2Config {

    private static final Logger log = LoggerFactory.getLogger(R2Config.class);

    @Value("${cloudflare.r2.account-id:}")
    private String accountId;

    @Value("${cloudflare.r2.access-key-id:}")
    private String accessKeyId;

    @Value("${cloudflare.r2.secret-access-key:}")
    private String secretAccessKey;

    @PostConstruct
    void validate() {
        if (accountId == null || accountId.isBlank()) {
            log.warn("Cloudflare R2 is not configured (R2_ACCOUNT_ID not set). " +
                     "PDFs will be stored locally only — set R2_* env vars to enable cloud upload.");
        }
    }

    public boolean isConfigured() {
        return accountId != null && !accountId.isBlank()
            && accessKeyId != null && !accessKeyId.isBlank()
            && secretAccessKey != null && !secretAccessKey.isBlank();
    }

    private URI endpointUri() {
        return URI.create("https://" + accountId + ".r2.cloudflarestorage.com");
    }

    private StaticCredentialsProvider credentials() {
        return StaticCredentialsProvider.create(
                AwsBasicCredentials.create(accessKeyId, secretAccessKey));
    }

    @Bean
    public S3Client r2S3Client() {
        if (!isConfigured()) {
            // Return a no-op placeholder — never invoked when R2 is not configured
            return S3Client.builder()
                    .endpointOverride(URI.create("https://r2.cloudflarestorage.com"))
                    .credentialsProvider(StaticCredentialsProvider.create(
                            AwsBasicCredentials.create("placeholder", "placeholder")))
                    .region(Region.of("auto"))
                    .build();
        }
        return S3Client.builder()
                .endpointOverride(endpointUri())
                .credentialsProvider(credentials())
                .region(Region.of("auto"))
                .build();
    }

    @Bean
    public S3Presigner r2S3Presigner() {
        if (!isConfigured()) {
            return S3Presigner.builder()
                    .endpointOverride(URI.create("https://r2.cloudflarestorage.com"))
                    .credentialsProvider(StaticCredentialsProvider.create(
                            AwsBasicCredentials.create("placeholder", "placeholder")))
                    .region(Region.of("auto"))
                    .build();
        }
        return S3Presigner.builder()
                .endpointOverride(endpointUri())
                .credentialsProvider(credentials())
                .region(Region.of("auto"))
                .build();
    }
}
