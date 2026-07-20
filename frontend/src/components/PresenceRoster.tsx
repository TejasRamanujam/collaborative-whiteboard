import type { RoomParticipant } from '../hooks/useLiveblocksRoom'
import { getUserColor } from './PresenceCursors'

export default function PresenceRoster({
  self,
  participants,
}: {
  self: string
  participants: RoomParticipant[]
}) {
  const people = [{ connectionId: -1, name: self }, ...participants]
  return (
    <div className="presence-roster" aria-label={`${people.length} at the bench`}>
      {people.slice(0, 5).map((person) => (
        <span className="roster-person" key={`${person.connectionId}-${person.name}`} title={person.name}>
          <i style={{ backgroundColor: getUserColor(person.name) }} aria-hidden="true" />
          <span>{person.connectionId === -1 ? 'you' : person.name}</span>
        </span>
      ))}
      {people.length > 5 && <span className="roster-more">+{people.length - 5}</span>}
    </div>
  )
}
