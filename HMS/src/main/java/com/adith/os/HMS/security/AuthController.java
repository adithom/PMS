package com.adith.os.HMS.security;

import com.adith.os.HMS.security.dto.AuthResponse;
import com.adith.os.HMS.security.dto.LoginRequest;
import com.adith.os.HMS.security.dto.RegisterRequest;
import com.adith.os.HMS.security.dto.UserInfoDto;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/register")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/me")
    public ResponseEntity<UserInfoDto> getCurrentUser(@AuthenticationPrincipal UserPrincipal userPrincipal) {
        User user = userPrincipal.getUser();

        String posLocationId = user.getPosLocation() != null ? user.getPosLocation().getId().toString() : null;
        String posLocationName = user.getPosLocation() != null ? user.getPosLocation().getName() : null;

        UserInfoDto userInfo = new UserInfoDto(
                user.getId().toString(),
                user.getUsername(),
                user.getEmail(),
                user.getRole().name(),
                user.getProperties().stream()
                        .map(p -> new UserInfoDto.PropertyInfo(
                                p.getId().toString(),
                                p.getName()
                        ))
                        .toList(),
                posLocationId,
                posLocationName
        );

        return ResponseEntity.ok(userInfo);
    }
}
