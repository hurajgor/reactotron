import React, { FunctionComponent } from "react"
import styled from "styled-components"

const Container = styled.div`
  height: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  color: ${(props) => props.theme.foregroundDark};
`

const Title = styled.div`
  color: ${(props) => props.theme.foregroundLight};
  font-size: 1.25rem;
  font-weight: 600;
  padding-bottom: 18px;
  padding-top: 12px;
`

const Message = styled.div`
  color: ${(props) => props.theme.foreground};
  max-width: 400px;
  line-height: 1.4;
  text-align: center;
`

const Image = styled.img`
  width: 52px;
  height: 52px;
  padding-bottom: 4px;
`

interface Props {
  icon?: any // TODO: Type Better?
  image?: any
  title?: string
}

const EmptyState: FunctionComponent<React.PropsWithChildren<Props>> = ({
  title,
  icon: Icon,
  image,
  children,
}) => {
  return (
    <Container>
      {Icon && <Icon size={52} />}
      {image && <Image src={image} />}
      {title && <Title>{title}</Title>}
      <Message>{children}</Message>
    </Container>
  )
}

export default EmptyState
