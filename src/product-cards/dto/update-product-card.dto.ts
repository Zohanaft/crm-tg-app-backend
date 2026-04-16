import { ApiProperty } from '@nestjs/swagger';
import { ProductCardPreviewImageDto } from './create-product-card.dto';

export class UpdateProductCardDto {
  @ApiProperty({ description: 'Card title' })
  title!: string;

  @ApiProperty({ description: 'Card description' })
  description!: string;

  @ApiProperty({
    description: 'Workspace IDs where this card is available',
    type: [String],
  })
  workspaceIds!: string[];

  @ApiProperty({
    description: 'Preview images uploaded to S3',
    type: [ProductCardPreviewImageDto],
  })
  previewImages!: ProductCardPreviewImageDto[];
}
