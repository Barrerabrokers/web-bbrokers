import type { MiaSequence, MiaDecision } from '@/lib/mia-sequence';
import { renderMiaSingleOption } from '@/lib/mia-proposal';
export function visibleMiaOffers(state:MiaSequence) {
  return state.offers.slice(0,state.offerPresentation?.shown??state.offers.length);
}
export function presentMiaOffer(state:MiaSequence,index:number):MiaDecision {
  return {next:{...state,stage:'unidades_presentadas',offerPresentation:{shown:index+1}},reply:renderMiaSingleOption(state.offers,index,state.facts.rooms)};
}
