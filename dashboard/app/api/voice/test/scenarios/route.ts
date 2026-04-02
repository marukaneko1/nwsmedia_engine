export const runtime = "nodejs";

export async function GET() {
  return Response.json([
    { id: "new-customer", label: "New Customer Inquiry", description: "I'm a new customer interested in your services" },
    { id: "reschedule", label: "Existing Customer Reschedule", description: "I need to reschedule my appointment" },
    { id: "complaint", label: "Complaint", description: "I'm unhappy with the service I received" },
    { id: "after-hours", label: "After Hours Call", description: "I'm calling after business hours" },
    { id: "yiddish", label: "Yiddish Speaker", description: "A Yiddish-speaking customer calling about services" },
    { id: "spanish", label: "Spanish Speaker", description: "A Spanish-speaking customer with a general inquiry" },
  ]);
}
