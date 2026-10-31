import type { Role } from '@crisiscraft/contracts';

export interface CrewMember {
  role: Role;
  name: string;
  title: string;
  post: string;
  /** What this person is responsible for knowing; shown on crew cards and given to the model. */
  remit: string;
  voice: string;
}

/** The three differently informed people the commander coordinates. All fictional. */
export const crew: Record<Role, CrewMember> = {
  logistics: {
    role: 'logistics', name: 'Priya', title: 'Logistics lead', post: 'Supply depot',
    remit: 'Depot stock, truck capacity and the road map. Proposes the dispatch plan.',
    voice: 'Calm, numerate, thinks in crates and minutes.',
  },
  shelter: {
    role: 'shelter', name: 'Malik', title: 'Shelter manager', post: 'School shelter',
    remit: 'What each shelter needs, by when, and whether it can unload a delivery.',
    voice: 'Warm but blunt about what people at the shelter need.',
  },
  field: {
    role: 'field', name: 'June', title: 'Field lead', post: 'North bridge',
    remit: 'Roads, water levels and what is passable right now.',
    voice: 'Short, direct radio style; always says how old a report is.',
  },
};

export const roles: Role[] = ['logistics', 'shelter', 'field'];

/** Radio names for the things the engine identifies by id. */
export const truckNames: Record<string, string> = { V1: 'Rescue 01', V2: 'Rescue 02' };
export const roadNames: Record<string, string> = {
  DJ: 'Harbour Road', JS: 'north bridge', DH: 'Mill Lane', HS: 'hill road', JH: 'ridge link', DE: 'coast road',
};
