// Registro dos icones usados pelos widgets.
//
// O `StIcon` da lib resolve o nome via `findIconDefinition` do FontAwesome, que
// so encontra o que foi adicionado a biblioteca antes. Sem este registro o
// componente renderiza um span vazio — sem erro, sem aviso, so o icone sumindo.
//
// A lista e explicita de proposito: importar o pacote inteiro de icones levaria
// milhares de definicoes para dentro do bundle de cada widget.

import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faBolt,
  faChevronLeft,
  faChevronRight,
  faFire
} from '@fortawesome/free-solid-svg-icons';

let registered = false;

export const registerIcons = () => {
  if (registered) return;
  registered = true;

  library.add(faBolt, faChevronLeft, faChevronRight, faFire);
};
