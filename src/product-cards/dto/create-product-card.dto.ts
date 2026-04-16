import { ApiProperty } from '@nestjs/swagger';

export class ProductCardPreviewImageDto {
  @ApiProperty({ description: 'S3 object key' })
  key!: string;

  @ApiProperty({ description: 'File URL (usually signed URL)' })
  url!: string;

  @ApiProperty({ description: 'Original filename from upload' })
  originalName!: string;
}

export class CreateProductCardDto {
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
