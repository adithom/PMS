package com.adith.os.HMS.config;

import com.adith.os.HMS.security.Role;
import com.adith.os.HMS.security.User;
import com.adith.os.HMS.security.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DatabaseSeeder {

    private static final Logger log = LoggerFactory.getLogger(DatabaseSeeder.class);

    @Value("${app.admin.username:adith}")
    private String myUsername;

    @Value("${app.admin.password:adith123}")
    private String myPassword;

    @Bean
    public CommandLineRunner seedDatabase(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            RoomInventorySeeder roomInventorySeeder
    ) {
        return args -> {
            seedAdminUser(userRepository, passwordEncoder);
            roomInventorySeeder.seedAll();
            roomInventorySeeder.syncAllTotalRooms();
        };
    }

    private void seedAdminUser(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        if (!userRepository.existsByUsername(myUsername)) {
            log.info("[Seeder] User '{}' not found. Bootstrapping account...", myUsername);
            User me = new User();
            me.setUsername(myUsername);
            me.setRole(Role.ADMIN);
            me.setPassword(passwordEncoder.encode(myPassword));
            userRepository.save(me);
            log.info("[Seeder] User '{}' created successfully.", myUsername);
        } else {
            log.info("[Seeder] User '{}' already exists. Skipping.", myUsername);
        }
    }
}
