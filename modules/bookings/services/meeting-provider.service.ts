export interface MeetingLocationDetails {
  locationType: string;
  locationDetails?: string;
}

export function generateMeetingLink(bookingId: string, locationType: string, locationDetails?: string): { type: string; link: string } {
  const normalizedType = locationType.toLowerCase();
  
  if (normalizedType.includes("zoom") || locationDetails?.toLowerCase().includes("zoom")) {
    const zoomId = bookingId.substring(0, 9).replace(/[^0-9]/g, "9");
    return {
      type: "Zoom",
      link: `https://zoom.us/j/${zoomId}?pwd=cally_${bookingId.substring(0, 6)}`,
    };
  }

  if (normalizedType.includes("teams") || locationDetails?.toLowerCase().includes("teams")) {
    return {
      type: "Microsoft Teams",
      link: `https://teams.microsoft.com/l/meetup-join/cally_${bookingId}`,
    };
  }

  if (normalizedType.includes("in-person") || normalizedType.includes("physical")) {
    return {
      type: "In-Person",
      link: locationDetails || "In-person location specified by host",
    };
  }

  // Default to Google Meet
  const roomCode = `${bookingId.substring(0, 3)}-${bookingId.substring(3, 7)}-${bookingId.substring(7, 10)}`.toLowerCase();
  return {
    type: "Google Meet",
    link: `https://meet.google.com/${roomCode}`,
  };
}
