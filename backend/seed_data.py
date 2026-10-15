"""
CivicPulse AI — Database Seeding Script
Seeds realistic civic issue reports across Andhra Pradesh, India
"""

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.database import SessionLocal, init_db
from app.models.report import Report, EvidenceCheck, StatusHistory, generate_report_id, utcnow

def seed():
    print("Initializing database...")
    init_db()
    db = SessionLocal()

    # Check if reports already exist
    existing = db.query(Report).count()
    if existing > 0:
        print(f"Database already contains {existing} reports. Skipping seed.")
        db.close()
        return

    print("Seeding realistic civic problem reports for Andhra Pradesh...")

    now = datetime.now(timezone.utc)

    # 10 realistic Andhra Pradesh civic issues
    sample_reports = [
        {
            "category": "pothole_damaged_road",
            "title": "Severe road crater and cave-in near Benz Circle flyover",
            "description": "Deep depression and asphalt collapse extending 1.5 meters across the left lane. Multiple two-wheelers have skidded during evening peak hours. Rain water accumulates quickly making it invisible.",
            "observed_severity": "critical",
            "is_safety_risk": True,
            "nearby_landmark": "Benz Circle, Opposite Trendset Mall",
            "address": "MG Road / Bandar Road, Vijayawada, Andhra Pradesh 520010",
            "latitude": 16.5005,
            "longitude": 80.6482,
            "location_source": "gps",
            "location_accuracy_m": 8.5,
            "status": "in_progress",
            "assigned_authority": "Vijayawada Municipal Corporation (VMC) - Roads Division",
            "priority_score": 92,
            "priority_level": "critical",
            "evidence_risk": "low",
            "ai_category": "Potholes & Damaged Roads",
            "ai_severity": "critical",
            "ai_confidence": "high",
            "ai_description": "Substantial road surface erosion with exposed aggregate and broken bitumen forming a hazardous depression directly in high-density vehicular path.",
            "age_days": 3,
        },
        {
            "category": "drainage_overflow",
            "title": "Stormwater drain overflow spilling sewage onto residential road",
            "description": "Main open storm drain blocked with construction debris and plastic waste. Black foul-smelling wastewater overflowing onto walking pathway and entering residential compound gates.",
            "observed_severity": "high",
            "is_safety_risk": True,
            "nearby_landmark": "Near MVP Colony Sector 4 Park",
            "address": "MVP Colony, Visakhapatnam, Andhra Pradesh 530017",
            "latitude": 17.7410,
            "longitude": 83.3340,
            "location_source": "gps",
            "location_accuracy_m": 12.0,
            "status": "forwarded",
            "assigned_authority": "Greater Visakhapatnam Municipal Corporation (GVMC) - Health & Sanitation",
            "priority_score": 88,
            "priority_level": "high",
            "evidence_risk": "low",
            "ai_category": "Drainage Overflow / Blocked Drains",
            "ai_severity": "high",
            "ai_confidence": "high",
            "ai_description": "Clogged culvert and overflowing greywater inundating the pedestrian sidewalk with potential contamination hazard.",
            "age_days": 2,
        },
        {
            "category": "garbage_dumping",
            "title": "Unauthorized open municipal waste dump along railway station road",
            "description": "Uncollected commercial packaging waste and domestic organic garbage rotting on the roadside curb. Attracting stray cattle and posing acute hygienic risk to pedestrians.",
            "observed_severity": "high",
            "is_safety_risk": False,
            "nearby_landmark": "Old Bus Stand Road, Near Guntur Railway Junction",
            "address": "Station Road, Guntur, Andhra Pradesh 522001",
            "latitude": 16.3067,
            "longitude": 80.4365,
            "location_source": "gps",
            "location_accuracy_m": 15.0,
            "status": "under_review",
            "assigned_authority": "Guntur Municipal Corporation (GMC)",
            "priority_score": 75,
            "priority_level": "medium",
            "evidence_risk": "low",
            "ai_category": "Garbage Dumping",
            "ai_severity": "high",
            "ai_confidence": "high",
            "ai_description": "Extensive accumulation of unsegregated municipal solid waste spilling into public thoroughfare.",
            "age_days": 4,
        },
        {
            "category": "waterlogging",
            "title": "Stagnant rainwater pool blocking school bus access route",
            "description": "Rain water pooling up to knee level due to lack of outflow gradient. Children and elders unable to cross. Water standing for over 48 hours without draining.",
            "observed_severity": "high",
            "is_safety_risk": False,
            "nearby_landmark": "Opposite Zilla Parishad High School",
            "address": "Alipiri Bypass Road, Tirupati, Andhra Pradesh 517501",
            "latitude": 13.6288,
            "longitude": 79.4192,
            "location_source": "gps",
            "location_accuracy_m": 10.0,
            "status": "submitted",
            "assigned_authority": None,
            "priority_score": 71,
            "priority_level": "medium",
            "evidence_risk": "low",
            "ai_category": "Waterlogging / Stagnant Water",
            "ai_severity": "medium",
            "ai_confidence": "high",
            "ai_description": "Large expanse of standing murky water completely submerging the vehicular lane and pedestrian kerb.",
            "age_days": 1,
        },
        {
            "category": "broken_streetlight",
            "title": "Row of 5 streetlights completely non-operational on dark stretch",
            "description": "Continuous 200m stretch of road in pitch darkness after 7 PM. Multiple female commuters have reported feeling unsafe. Suspected underground cable cut.",
            "observed_severity": "medium",
            "is_safety_risk": True,
            "nearby_landmark": "Near Collectorate Complex, Kakinada",
            "address": "Main Road, Kakinada, Andhra Pradesh 533001",
            "latitude": 16.9891,
            "longitude": 82.2475,
            "location_source": "gps",
            "location_accuracy_m": 18.0,
            "status": "acknowledged",
            "assigned_authority": "Eastern Power Distribution Company of AP (APEPDCL)",
            "priority_score": 79,
            "priority_level": "high",
            "evidence_risk": "low",
            "ai_category": "Broken Streetlights",
            "ai_severity": "medium",
            "ai_confidence": "high",
            "ai_description": "Streetlight luminaire fixtures present but visibly dark during nighttime conditions.",
            "age_days": 5,
        },
        {
            "category": "sewage_leakage",
            "title": "High-pressure sewage main pipe fracture leaking onto main highway",
            "description": "Underground sewer main rupture resulting in continuous flow of foul water crossing the service lane into storm drain. Strong stench across 100 meter radius.",
            "observed_severity": "critical",
            "is_safety_risk": True,
            "nearby_landmark": "Beside NH16 Service Road, Tadepalli",
            "address": "NH16 Amaravati Bypass, Tadepalli, Guntur Dist, Andhra Pradesh 522501",
            "latitude": 16.4833,
            "longitude": 80.6000,
            "location_source": "gps",
            "location_accuracy_m": 7.0,
            "status": "in_progress",
            "assigned_authority": "AP CRDA / Tadepalli Municipality",
            "priority_score": 94,
            "priority_level": "critical",
            "evidence_risk": "low",
            "ai_category": "Sewage Leakage",
            "ai_severity": "critical",
            "ai_confidence": "high",
            "ai_description": "Active pressurized sewer discharge bubbling out of ground cover, flooding asphalt surface.",
            "age_days": 1,
        },
        {
            "category": "damaged_infrastructure",
            "title": "Broken pedestrian bridge railing over irrigation canal",
            "description": "Iron railing broken and missing over a 3-meter section of footbridge. Dangerous fall hazard of 15 feet into irrigation canal for schoolchildren and cyclists.",
            "observed_severity": "critical",
            "is_safety_risk": True,
            "nearby_landmark": "Canal Road, Near Ryves Canal Bridge",
            "address": "Satyanarayanapuram, Vijayawada, Andhra Pradesh 520011",
            "latitude": 16.5186,
            "longitude": 80.6350,
            "location_source": "manual",
            "location_accuracy_m": 25.0,
            "status": "forwarded",
            "assigned_authority": "Water Resources Dept & VMC Engineering",
            "priority_score": 96,
            "priority_level": "critical",
            "evidence_risk": "low",
            "ai_category": "Damaged Public Infrastructure",
            "ai_severity": "critical",
            "ai_confidence": "high",
            "ai_description": "Missing guardrail barrier over drop to water body creating imminent fall risk.",
            "age_days": 6,
        },
        {
            "category": "pothole_damaged_road",
            "title": "Asphalt peeling and multiple potholes near RTC Complex",
            "description": "Continuous series of potholes slowing down state transport buses and causing severe traffic bottleneck during morning hours.",
            "observed_severity": "medium",
            "is_safety_risk": False,
            "nearby_landmark": "Opposite APSRTC Complex Entrance",
            "address": "RTC Complex Road, Rajahmundry, Andhra Pradesh 533101",
            "latitude": 17.0005,
            "longitude": 81.8040,
            "location_source": "gps",
            "location_accuracy_m": 14.0,
            "status": "resolved",
            "assigned_authority": "Rajahmundry Municipal Corporation (RMC)",
            "priority_score": 64,
            "priority_level": "medium",
            "evidence_risk": "low",
            "ai_category": "Potholes & Damaged Roads",
            "ai_severity": "medium",
            "ai_confidence": "medium",
            "ai_description": "Surface level asphalt disintegration with multiple 20-30cm diameter potholes.",
            "age_days": 12,
        },
        {
            "category": "drainage_overflow",
            "title": "Choked roadside drain causing mosquito breeding ground",
            "description": "Dense silt and plastic bottles blocking water passage. Stagnant green algae layer formed with dense mosquito breeding.",
            "observed_severity": "medium",
            "is_safety_risk": False,
            "nearby_landmark": "Near Children's Park, Auto Nagar",
            "address": "Auto Nagar 100ft Road, Kurnool, Andhra Pradesh 518003",
            "latitude": 15.8281,
            "longitude": 78.0373,
            "location_source": "gps",
            "location_accuracy_m": 11.0,
            "status": "under_review",
            "assigned_authority": "Kurnool Municipal Corporation",
            "priority_score": 68,
            "priority_level": "medium",
            "evidence_risk": "low",
            "ai_category": "Drainage Overflow / Blocked Drains",
            "ai_severity": "medium",
            "ai_confidence": "high",
            "ai_description": "Blocked street-level masonry drain with stagnant standing water and floating litter.",
            "age_days": 5,
        },
        {
            "category": "garbage_dumping",
            "title": "Burning plastic and garbage dump behind commercial market",
            "description": "Toxic smoke from burning refuse behind wholesale vegetable market. Residents facing breathing difficulties.",
            "observed_severity": "critical",
            "is_safety_risk": True,
            "nearby_landmark": "Behind Rythu Bazaar, Nellore",
            "address": "Trunk Road, Nellore, Andhra Pradesh 524001",
            "latitude": 14.4426,
            "longitude": 79.9865,
            "location_source": "gps",
            "location_accuracy_m": 9.0,
            "status": "acknowledged",
            "assigned_authority": "Nellore Municipal Corporation & APPCB",
            "priority_score": 90,
            "priority_level": "critical",
            "evidence_risk": "low",
            "ai_category": "Garbage Dumping",
            "ai_severity": "critical",
            "ai_confidence": "high",
            "ai_description": "Smoldering refuse pile producing heavy smoke adjacent to commercial and residential structures.",
            "age_days": 1,
        },
    ]

    for item in sample_reports:
        created_time = now - timedelta(days=item["age_days"], hours=4)
        rep = Report(
            report_id=generate_report_id(),
            created_at=created_time,
            updated_at=created_time + timedelta(hours=6),
            category=item["category"],
            title=item["title"],
            description=item["description"],
            observed_severity=item["observed_severity"],
            observed_at=created_time - timedelta(hours=2),
            is_safety_risk=item["is_safety_risk"],
            nearby_landmark=item["nearby_landmark"],
            address=item["address"],
            latitude=item["latitude"],
            longitude=item["longitude"],
            location_source=item["location_source"],
            location_accuracy_m=item["location_accuracy_m"],
            status=item["status"],
            assigned_authority=item["assigned_authority"],
            priority_score=item["priority_score"],
            priority_level=item["priority_level"],
            priority_breakdown=json.dumps({
                "severity_score": 30 if item["observed_severity"] == "critical" else 20,
                "safety_risk_bonus": 30 if item["is_safety_risk"] else 0,
                "evidence_provenance_score": 20,
                "density_cluster_score": 10,
                "total_score": item["priority_score"],
                "priority_level": item["priority_level"],
            }),
            evidence_risk=item["evidence_risk"],
            duplicate_status="unique",
            ai_category=item["ai_category"],
            ai_severity=item["ai_severity"],
            ai_confidence=item["ai_confidence"],
            ai_description=item["ai_description"],
            ai_analysis_status="completed",
            location_consent=True,
            submission_consent=True,
            user_firebase_uid="dev-citizen-uid",
        )
        db.add(rep)
        db.flush()

        # Status timeline history
        history_steps = [("submitted", "Report submitted by citizen via CivicPulse.")]
        if item["status"] != "submitted":
            history_steps.append(("under_review", "Evidence verified by AI engine and queued for triage."))
        if item["status"] in ["forwarded", "acknowledged", "in_progress", "resolved"]:
            history_steps.append(("forwarded", f"Forwarded to {item['assigned_authority'] or 'competent department'}."))
        if item["status"] in ["acknowledged", "in_progress", "resolved"]:
            history_steps.append(("acknowledged", "Acknowledged by department field supervisor."))
        if item["status"] in ["in_progress", "resolved"]:
            history_steps.append(("in_progress", "Work order issued. Field team dispatched for site inspection."))
        if item["status"] == "resolved":
            history_steps.append(("resolved", "Remediation work completed and verified on-site."))

        for idx, (stat, note) in enumerate(history_steps):
            hist = StatusHistory(
                report_id=rep.report_id,
                changed_at=created_time + timedelta(hours=idx * 8),
                from_status=history_steps[idx - 1][0] if idx > 0 else None,
                to_status=stat,
                changed_by="civicpulse_system" if idx == 0 else "dev-admin-uid",
                reason=note,
            )
            db.add(hist)

        # Evidence check record
        check = EvidenceCheck(
            report_id=rep.report_id,
            checked_at=created_time + timedelta(minutes=1),
            file_integrity="pass",
            mime_type="image/jpeg",
            magic_bytes_match=True,
            metadata_status="present",
            location_consistency="consistent",
            duplicate_status="unique",
            ai_analysis_status="completed",
            evidence_risk="low",
            findings=json.dumps([
                "Image integrity validated without tampering indicators.",
                f"Coordinates {item['latitude']}, {item['longitude']} match geographic context of Andhra Pradesh.",
                f"AI visual model corroborated issue as {item['ai_category']}.",
            ]),
            limitations=json.dumps([
                "Automated classification provides a supportive signal.",
                "Mobile browser GPS accuracy is self-reported by client device.",
            ]),
            requires_review=False,
            location_distance_m=12.4,
        )
        db.add(check)

    db.commit()
    print(f"Successfully seeded {len(sample_reports)} reports into CivicPulse database!")
    db.close()

if __name__ == "__main__":
    seed()
