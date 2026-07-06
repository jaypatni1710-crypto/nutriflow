import { SVGProps } from 'react';

export interface NavItem {
  label: string;
  path: string;
  icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
}

function DashboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 13.5h6.75V4.5H3.75v9zm0 6h6.75v-3.75H3.75V19.5zM12.75 19.5h7.5V10.5h-7.5v9zm0-15v3.75h7.5V4.5h-7.5z"
      />
    </svg>
  );
}

function ClientsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
      />
    </svg>
  );
}

function DietPlanIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 3v6.75a2.25 2.25 0 002.25 2.25h.75M8.25 3H6.75a1.5 1.5 0 00-1.5 1.5v3a2.25 2.25 0 002.25 2.25M8.25 3v0M9.75 12v9M15.75 3v18M15.75 3a3 3 0 013 3v3a3 3 0 01-3 3"
      />
    </svg>
  );
}

function AppointmentsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0V11.25a2.25 2.25 0 012.25-2.25h13.5a2.25 2.25 0 012.25 2.25v7.5m-15-3h.008v.008H8.25V15.75zm3 0h.008v.008H11.25V15.75zm3 0h.008v.008H14.25V15.75z"
      />
    </svg>
  );
}

// V1 scope: Dashboard + Clients only. Do not add placeholder items for
// future modules — extend this list when the next module actually ships.
export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
  { label: 'Clients', path: '/dashboard/clients', icon: ClientsIcon },
  { label: 'Diet Plan', path: '/dashboard/diet-plan', icon: DietPlanIcon },
  { label: 'Appointments', path: '/dashboard/appointments', icon: AppointmentsIcon },
];