package com.adith.os.HMS.admin;

import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final ConfigurableApplicationContext context;

    public AdminController(ConfigurableApplicationContext context) {
        this.context = context;
    }

    @PostMapping("/restart")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> restart() {
        Thread t = new Thread(context::close);
        t.setDaemon(false);
        t.start();
        return ResponseEntity.ok(Map.of("message", "Server is restarting..."));
    }
}
