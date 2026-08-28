from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from appointments.models import Appointment
from .models import Patient


class PatientSchemaTests(TestCase):
	def setUp(self):
		self.user = get_user_model().objects.create_user(
			username="patient-test", password="password123"
		)
		self.client = APIClient()
		self.client.force_authenticate(self.user)

	def test_patient_requires_only_name_and_gender(self):
		response = self.client.post(
			"/api/patients/",
			{"full_name": "Minimal Patient", "gender": "female"},
			format="json",
		)

		self.assertEqual(response.status_code, 201)
		self.assertIsNone(response.data["date_of_birth"])
		self.assertIsNone(response.data["age"])
		self.assertIsNone(response.data["last_visited"])

	def test_age_is_dynamic_and_last_visited_uses_completed_appointments(self):
		dob = date.today().replace(year=date.today().year - 35)
		patient = Patient.objects.create(full_name="Complete Patient", gender="male", date_of_birth=dob)
		Appointment.objects.create(
			patient=patient,
			date=date.today() - timedelta(days=2),
			time="09:00",
			status=Appointment.Status.COMPLETED,
		)
		Appointment.objects.create(
			patient=patient,
			date=date.today(),
			time="10:00",
			status=Appointment.Status.SCHEDULED,
		)

		response = self.client.get(f"/api/patients/{patient.pk}/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["age"], 35)
		self.assertEqual(response.data["last_visited"], str(date.today() - timedelta(days=2)))
