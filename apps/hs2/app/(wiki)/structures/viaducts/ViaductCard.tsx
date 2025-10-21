import { Card } from '@chakra-ui/react';
import Link from 'next/link';

const ViaductCard = ({ id, name }: { id: string; name: string }) => (
  <Link href={`/structures/viaducts/${id}`}>
    <Card.Root overflow='hidden' variant='subtle'>
      {/* <Image
      src='https://assets.hs2.org.uk/wp-content/uploads/2025/02/HS2-Long-Itchington-tunnel-walk-25_cropped-1400x631.png'
      alt='Viaducts'
      height={300}
      objectFit='cover'
      objectPosition='left'
    /> */}
      <Card.Body gap='2'>
        <Card.Title color='blue.400'>
          {name.replace(' East Viaduct', ' Viaducts')}
        </Card.Title>
        {name.includes('East Viaduct') && (
          <Card.Description>
            {name} and {name.replace(' East Viaduct', ' West Viaduct')}
          </Card.Description>
        )}
      </Card.Body>
    </Card.Root>
  </Link>
);

export default ViaductCard;
