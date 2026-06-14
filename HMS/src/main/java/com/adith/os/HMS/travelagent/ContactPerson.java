package com.adith.os.HMS.travelagent;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

@Entity
@Table(name = "contact_person")
public class ContactPerson {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @NotBlank
    @Column(nullable = false)
    private String name;

    private String phone;

    private String email;

    private String designation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "travel_agent_id", nullable = false)
    private TravelAgent travelAgent;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getDesignation() { return designation; }
    public void setDesignation(String designation) { this.designation = designation; }

    public TravelAgent getTravelAgent() { return travelAgent; }
    public void setTravelAgent(TravelAgent travelAgent) { this.travelAgent = travelAgent; }
}
