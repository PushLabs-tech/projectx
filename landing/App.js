import {
  Header,
  Hero,
  PurposeSection,
  CreateSection,
  DifferenceSection,
  ExperienceSection,
  BrainSection,
  LoopSection,
  FinalCTAAndFooter,
} from './components.js';

export function App() {
  return Header() +
    '<main id="main-content">' +
    Hero() +
    PurposeSection() +
    CreateSection() +
    DifferenceSection() +
    ExperienceSection() +
    BrainSection() +
    LoopSection() +
    FinalCTAAndFooter() +
    '</main>';
}
