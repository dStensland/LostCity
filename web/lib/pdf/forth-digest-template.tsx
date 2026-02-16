import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    backgroundColor: "#FFFBF5",
    color: "#1a1a1a",
  },
  // Cover section
  cover: {
    marginBottom: 30,
  },
  brandTag: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    color: "#9B8A6E",
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#666",
    marginBottom: 20,
  },
  // Weather section
  weatherBox: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "#F5F0E8",
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    gap: 8,
  },
  weatherTemp: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  weatherCondition: {
    fontSize: 10,
    color: "#666",
  },
  // Section header
  sectionHeader: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    marginBottom: 10,
    marginTop: 16,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#E5DFD3",
  },
  // Event row
  eventRow: {
    flexDirection: "row" as const,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#EDEAE3",
    gap: 10,
  },
  eventTime: {
    width: 60,
    fontSize: 10,
    color: "#9B8A6E",
    fontFamily: "Helvetica-Bold",
  },
  eventContent: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  eventVenue: {
    fontSize: 9,
    color: "#888",
  },
  // Restaurant row
  restaurantRow: {
    flexDirection: "row" as const,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#EDEAE3",
    gap: 10,
  },
  restaurantName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    flex: 1,
  },
  restaurantType: {
    fontSize: 9,
    color: "#888",
  },
  restaurantDistance: {
    fontSize: 9,
    color: "#9B8A6E",
    width: 60,
    textAlign: "right" as const,
  },
  // Footer
  footer: {
    position: "absolute" as const,
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center" as const,
    fontSize: 8,
    color: "#BBB",
  },
});

// ============================================================================
// TYPES
// ============================================================================

export interface DigestEvent {
  title: string;
  start_time: string | null;
  venue_name: string | null;
  category: string | null;
}

export interface DigestRestaurant {
  name: string;
  venue_type: string | null;
  neighborhood: string | null;
  distance_km: number;
}

export interface DigestWeather {
  temperature_f: number;
  condition: string;
}

export interface ForthDigestProps {
  portalName: string;
  dates: string; // e.g., "Feb 15-17, 2026"
  weather: DigestWeather | null;
  events: DigestEvent[];
  restaurants: DigestRestaurant[];
  generatedAt: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

function formatEventTime(time: string | null): string {
  if (!time) return "TBD";
  const [hours, minutes] = time.split(":").map(Number);
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${ampm}`;
}

export default function ForthDigestTemplate({
  portalName,
  dates,
  weather,
  events,
  restaurants,
  generatedAt,
}: ForthDigestProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Cover */}
        <View style={styles.cover}>
          <Text style={styles.brandTag}>{portalName} CONCIERGE</Text>
          <Text style={styles.title}>Your Weekend Brief</Text>
          <Text style={styles.subtitle}>{dates}</Text>
        </View>

        {/* Weather */}
        {weather && (
          <View style={styles.weatherBox}>
            <Text style={styles.weatherTemp}>
              {Math.round(weather.temperature_f)}{"\u00B0"}F
            </Text>
            <Text style={styles.weatherCondition}>
              {weather.condition.charAt(0).toUpperCase() + weather.condition.slice(1)}
            </Text>
          </View>
        )}

        {/* Top Events */}
        {events.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>
              Top Events During Your Stay
            </Text>
            {events.slice(0, 8).map((event, i) => (
              <View key={i} style={styles.eventRow}>
                <Text style={styles.eventTime}>
                  {formatEventTime(event.start_time)}
                </Text>
                <View style={styles.eventContent}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventVenue}>
                    {event.venue_name || event.category || ""}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Restaurant Picks */}
        {restaurants.length > 0 && (
          <>
            <Text style={styles.sectionHeader}>Restaurant Picks Nearby</Text>
            {restaurants.slice(0, 6).map((restaurant, i) => (
              <View key={i} style={styles.restaurantRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.restaurantName}>{restaurant.name}</Text>
                  <Text style={styles.restaurantType}>
                    {[restaurant.venue_type, restaurant.neighborhood]
                      .filter(Boolean)
                      .join(" \u2022 ")}
                  </Text>
                </View>
                <Text style={styles.restaurantDistance}>
                  {restaurant.distance_km < 1
                    ? `${Math.round(restaurant.distance_km * 1000)}m`
                    : `${restaurant.distance_km.toFixed(1)}km`}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Generated {generatedAt} \u2022 Powered by LostCity \u2022 {portalName}
        </Text>
      </Page>
    </Document>
  );
}
