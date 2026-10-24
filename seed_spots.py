from django.core.management.base import BaseCommand
from spots.models import Spot

# Coordinates are approximate. Verify each one by long-pressing the spot in
# Google Maps and copying the lat/long before the demo.
SPOTS = [
    ("Rivera Library", "Main campus library with group study rooms.", 33.9741, -117.3282, "quiet", True, True, True, True),
    ("Orbach Science Library", "Quiet science library with lots of seating.", 33.9745, -117.3256, "quiet", True, True, True, False),
    ("Student Success Center", "Study tables and tutoring space.", 33.9757, -117.3270, "moderate", True, True, True, True),
    ("Highlander Union Building (HUB)", "Open seating near food and the bookstore.", 33.9748, -117.3288, "loud", True, True, True, True),
    ("Bell Tower Lawn", "Outdoor grass area in the center of campus.", 33.9738, -117.3281, "moderate", False, True, False, True),
    ("Costo Hall Lounge", "Lounge seating on the upper floors.", 33.9750, -117.3290, "moderate", True, True, True, True),
    ("Bourns Hall Atrium", "Engineering building with tables and outlets.", 33.9814, -117.3275, "moderate", True, True, True, True),
    ("Surge Building Courtyard", "Shaded courtyard with benches.", 33.9753, -117.3262, "quiet", False, True, False, False),
    ("Student Recreation Center Lounge", "Lounge area near the gym entrance.", 33.9768, -117.3128, "loud", True, True, True, True),
    ("UCR Botanic Gardens Entrance", "Quiet outdoor benches away from the main campus.", 33.9680, -117.3180, "quiet", False, False, False, False),
]


class Command(BaseCommand):
    help = "Seed the database with well-known UCR study spots (safe to run repeatedly)."

    def handle(self, *args, **options):
        for name, desc, lat, lng, noise, outlets, wifi, indoor, group in SPOTS:
            _, created = Spot.objects.update_or_create(
                name=name,
                defaults={
                    "description": desc,
                    "latitude": lat,
                    "longitude": lng,
                    "noise_level": noise,
                    "has_outlets": outlets,
                    "has_wifi": wifi,
                    "is_indoor": indoor,
                    "group_friendly": group,
                },
            )
            self.stdout.write(f"{'Created' if created else 'Updated'}: {name}")
        self.stdout.write(self.style.SUCCESS(f"Done. {Spot.objects.count()} spots in database."))
