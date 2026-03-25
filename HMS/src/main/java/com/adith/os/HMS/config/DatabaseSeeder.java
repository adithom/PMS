package com.adith.os.HMS.config;

import com.adith.os.HMS.security.Role; 
import com.adith.os.HMS.security.User;
import com.adith.os.HMS.security.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DatabaseSeeder {

    // Using your name as the default, but you can override this in production via env vars
    @Value("${app.admin.username:adith}")
    private String myUsername;

    @Value("${app.admin.email:adith@spicetree.com}")
    private String myEmail; 

    @Value("${app.admin.password:adith123}")
    private String myPassword;

    @Bean
    public CommandLineRunner seedDatabase(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            // Check if YOUR specific user exists by username
            boolean userExists = userRepository.existsByUsername(myUsername);

            if (!userExists) {
                System.out.println("Specific user '" + myUsername + "' not found. Bootstrapping account...");
                
                User me = new User();
                me.setUsername(myUsername);
                me.setEmail(myEmail);
                
                me.setRole(Role.ADMIN); 
                
                // CRITICAL: Hash the password before saving
                me.setPassword(passwordEncoder.encode(myPassword));

                userRepository.save(me);
                
                System.out.println("User '" + myUsername + "' created successfully.");
            } else {
                System.out.println("User '" + myUsername + "' already exists. Skipping bootstrap.");
            }
        };
    }
}
