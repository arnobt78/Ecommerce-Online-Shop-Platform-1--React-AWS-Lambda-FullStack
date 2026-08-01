/**
 * AddressLines Component
 *
 * Shared 4-line postal address rendering (name / street / city-state-zip /
 * country) — used everywhere a saved Address or an order's shipping-address
 * snapshot is displayed (Dashboard AddressBook, AdminUserDetailPage,
 * OrderTrackingInfo, AdminOrderDetailPage) so the format stays identical
 * and isn't hand-duplicated per page.
 */

interface AddressLike {
  fullName: string;
  street1: string;
  street2?: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface AddressLinesProps {
  address: AddressLike;
  className?: string;
}

export function AddressLines({ address, className = "" }: AddressLinesProps) {
  return (
    <div className={className}>
      <p>{address.fullName}</p>
      <p>
        {address.street1}
        {address.street2 ? `, ${address.street2}` : ""}
      </p>
      <p>
        {address.city}, {address.state} {address.zip}
      </p>
      <p>{address.country}</p>
    </div>
  );
}
