import math

# Function to calculate distance between two GPS points
def calculate_distance(lat1, lon1, lat2, lon2):

    R = 6371000  # Earth radius in meters

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)

    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    distance = R * c

    return distance


# Function to check if inside geofence
def check_geofence(user_lat, user_lng, zone_lat, zone_lng, radius):

    distance = calculate_distance(user_lat, user_lng, zone_lat, zone_lng)

    if distance <= radius:
        return True
    else:
        return False