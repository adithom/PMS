package com.adith.os.HMS.config;

import com.adith.os.HMS.property.Property;
import com.adith.os.HMS.property.PropertyRepository;
import com.adith.os.HMS.room.Room;
import com.adith.os.HMS.room.RoomRepository;
import com.adith.os.HMS.room.RoomStatus;
import com.adith.os.HMS.unit.Unit;
import com.adith.os.HMS.unit.UnitRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

@Service
public class RoomInventorySeeder {

    private static final Logger log = LoggerFactory.getLogger(RoomInventorySeeder.class);

    private final PropertyRepository propertyRepository;
    private final UnitRepository unitRepository;
    private final RoomRepository roomRepository;

    public RoomInventorySeeder(PropertyRepository propertyRepository,
                               UnitRepository unitRepository,
                               RoomRepository roomRepository) {
        this.propertyRepository = propertyRepository;
        this.unitRepository = unitRepository;
        this.roomRepository = roomRepository;
    }

    public void seedAll() {
        // SpiceTree Munnar (STM)
        seedUnit("STM", "SpiceTree Munnar",
                "Classic Cottage with Jacuzzi", 16500, 1,
                List.of("101","102","103","104","201","202","203","204","301","302","303","304"));

        seedUnit("STM", "SpiceTree Munnar",
                "Plunge Pool Villa", 23500, 2,
                List.of("501","502"));

        seedUnit("STM", "SpiceTree Munnar",
                "Private Pool Villa", 34500, 3,
                List.of("601","603"));

        // SpiceTree Rajakumari (STR)
        seedUnit("STR", "SpiceTree Rajakumari",
                "Garden Villa", 16500, 1,
                List.of("102","103","104","105","106","201","202","203","204"));

        // SpiceTree Chinnar (STC)
        seedUnit("STC", "SpiceTree Chinnar",
                "Garden Pool Villa", 18000, 1,
                List.of("1","2","3","4","5","6"));

        seedUnit("STC", "SpiceTree Chinnar",
                "Tent Room", 10000, 2,
                List.of("7"));
    }

    @Transactional
    public void seedUnit(String propertyCode, String propertyName,
                         String unitName, int ratePerNight, int sortOrder,
                         List<String> roomNumbers) {
        Property property = resolveProperty(propertyCode, propertyName);

        Unit unit;
        Optional<Unit> unitOpt = unitRepository.findByNameAndPropertyId(unitName, property.getId());
        if (unitOpt.isEmpty()) {
            unit = new Unit(unitName, property, sortOrder, 0);
            unitRepository.save(unit);
            log.info("[Seeder] Created unit '{}' for property {}", unitName, propertyCode);
        } else {
            unit = unitOpt.get();
            log.info("[Seeder] Unit '{}' already exists for property {}. Skipping.", unitName, propertyCode);
        }

        for (String roomNumber : roomNumbers) {
            if (!roomRepository.existsByPropertyIdAndNumber(property.getId(), roomNumber)) {
                Room room = new Room(property, unit, roomNumber);
                room.setBaseRate(BigDecimal.valueOf(ratePerNight));
                room.setCapacity(2);
                room.setStatus(RoomStatus.ACTIVE);
                roomRepository.save(room);
                log.info("[Seeder] Created room {} in '{}' ({})", roomNumber, unitName, propertyCode);
            } else {
                log.debug("[Seeder] Room {} in '{}' ({}) already exists. Skipping.", roomNumber, unitName, propertyCode);
            }
        }
    }

    @Transactional
    public void syncAllTotalRooms() {
        List<Property> all = propertyRepository.findAll();
        for (Property p : all) {
            unitRepository.findByPropertyIdOrderBySortOrder(p.getId())
                    .forEach(u -> unitRepository.updateTotalRooms(u.getId()));
            propertyRepository.updateTotalRooms(p.getId());
        }
        log.info("[Seeder] Synced totalRooms for {} properties.", all.size());
    }

    private Property resolveProperty(String code, String name) {
        return propertyRepository.findByCode(code).orElseGet(() -> {
            Property p = new Property();
            p.setCode(code);
            p.setName(name);
            p.setCountry("India");
            Property saved = propertyRepository.save(p);
            log.info("[Seeder] Created property '{}' ({})", name, code);
            return saved;
        });
    }
}
