package com.adith.os.HMS.security;

import com.adith.os.HMS.property.Property;
import jakarta.persistence.*;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * User entity representing department-level access accounts.
 * Each user represents a department (Admin, FrontDesk, Housekeeping, etc.)
 * rather than individual staff members.
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false, length = 50)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(unique = true, length = 100)
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;


    /**
     * Properties this department/user can access
     * Many-to-Many relationship
     * Example: A manager account might have access to multiple properties
     */
    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
            name = "user_properties",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "property_id")
    )
    private Set<Property> properties = new HashSet<>();


    // ========== Constructors ==========

    public User() {}

    public User(String username, String password, String email, Role role) {
        this.username = username;
        this.password = password;
        this.email = email;
        this.role = role;
    }

    // ========== Getters and Setters ==========

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public Set<Property> getProperties() {
        return properties;
    }

    public void setProperties(Set<Property> properties) {
        this.properties = properties;
    }

    // ========== Helper Methods ==========

    /**
     * Add a property to this user's access list
     */
    public void addProperty(Property property) {
        this.properties.add(property);
    }

    /**
     * Remove a property from this user's access list
     */
    public void removeProperty(Property property) {
        this.properties.remove(property);
    }

    /**
     * Check if this user has access to a specific property
     */
    public boolean hasAccessToProperty(UUID propertyId) {
        return properties.stream()
                .anyMatch(p -> p.getId().equals(propertyId));
    }

    @Override
    public String toString() {
        return "User{" +
                "id=" + id +
                ", username='" + username + '\'' +
                ", email='" + email + '\'' +
                ", role=" + role +
                '}';
    }
}
