'use client'

import Image from 'next/image'
import styles from './landing.module.css'

type LandingImageProps = {
  src: string
  alt: string
  width: number
  height: number
  sizes: string
  preload?: boolean
  className?: string
}

export default function LandingImage({ className = '', width, height, alt, ...props }: LandingImageProps) {
  return (
    <div className={`${styles.imageFrame} ${className}`} style={{ aspectRatio: `${width} / ${height}` }}>
      <Image
        {...props}
        alt={alt}
        width={width}
        height={height}
        className={styles.image}
        ref={image => {
          if (image) image.dataset.loading = String(!image.complete)
        }}
        onLoad={event => { event.currentTarget.dataset.loading = 'false' }}
        onError={event => { event.currentTarget.dataset.loading = 'false' }}
      />
    </div>
  )
}
