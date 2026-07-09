import React from "react"
import { MdOutlineCheckBox, MdOutlineCheckBoxOutlineBlank } from "react-icons/md"
import styled from "styled-components"

const Container = styled.div`
  display: flex;
  cursor: pointer;
  padding: 5px 0;
`
const IconContainer = styled.div`
  padding-right: 10px;
  color: ${(props) => props.theme.highlight};
`
const Label = styled.span`
  color: ${(props) => props.theme.foreground};
`

interface Props {
  isChecked: boolean
  label: string
  onToggle: () => void
}

function Checkbox({ isChecked, label, onToggle }: Props) {
  const Icon = isChecked ? MdOutlineCheckBox : MdOutlineCheckBoxOutlineBlank

  return (
    <Container onClick={onToggle}>
      <IconContainer>
        <Icon />
      </IconContainer>
      <Label>{label}</Label>
    </Container>
  )
}

export default Checkbox
