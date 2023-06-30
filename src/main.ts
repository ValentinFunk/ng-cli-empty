import 'zone.js/dist/zone';
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { bootstrapApplication } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ComponentStore } from '@ngrx/component-store';
import { tap, debounceTime, switchMap } from 'rxjs/operators';
import { ZxcvbnResult, zxcvbnAsync, zxcvbnOptions } from '@zxcvbn-ts/core';
import { RxLet } from '@rx-angular/template/let'

async function measureStrength(password: string, name: string, email: string) {
  const zxcvbnCommonPackage = await import(
    /* webpackChunkName: "pwStrengthData" */ '@zxcvbn-ts/language-common'
  );
  const zxcvbnEnPackage = await import(
    /* webpackChunkName: "pwStrengthData" */ '@zxcvbn-ts/language-en'
  );
  const pwned = await import(
    /* webpackChunkName: "pwStrengthData" */ '@zxcvbn-ts/matcher-pwned'
  );
  if (!zxcvbnOptions.matchers['pwned']) {
    const matcherPwned = pwned.matcherPwnedFactory(fetch, zxcvbnOptions);
    zxcvbnOptions.addMatcher('pwned', matcherPwned);
  }

  zxcvbnOptions.setOptions({
    dictionary: {
      ...zxcvbnCommonPackage.dictionary,
      ...zxcvbnEnPackage.dictionary,
    },
    graphs: zxcvbnCommonPackage.adjacencyGraphs,
    translations: zxcvbnEnPackage.translations,
  });

  return zxcvbnAsync(password, [name, email]);
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RxLet],
  template: `
    <h1>Password strength</h1>
    <label>Name</label>
    <input type="text" (input)="setName(nameInput.value)" #nameInput>

    <label>Email</label>
    <input type="text" (input)="setEmail(emailInput.value)" #emailInput>

    <label>Password</label>

    <input type="password" (input)="updatePw(input.value)" #input>

    <span *ngIf="validating$ | async">Loading</span>
    <ng-container *rxLet="validationResult$ as result">
      <div>Strength: {{ result?.score ?? 0 }} {{ result?.feedback?.warning }}</div>
      <div>
        <div *ngIf="result?.feedback?.suggestions?.length">
        <h3>Tips for a stronger password:</h3>
        <ul>
          <li *ngFor="let tip of result?.feedback?.suggestions">{{ tip }}</li>
        </ul>
        </div>
      </div>
    </ng-container>
  `,
})
export class AppComponent extends ComponentStore<{
  validating: boolean;
  result?: ZxcvbnResult;
  name: string;
  email: string;
}> {
  constructor() {
    super({
      validating: false,
      name: '',
      email: ''
    });
  }

  setName = this.updater((state, name: string) => ({ ...state, name }));
  setEmail = this.updater((state, email: string) => ({ ...state, email }));

  validating$ = this.select((state) => state.validating);
  validationResult$ = this.select((state) => state.result);
  updatePw = this.effect<string>((trigger$) =>
    trigger$.pipe(
      tap((ev) => {
        console.log(ev);
        this.patchState({ validating: true });
      }),
      debounceTime(200),
      switchMap((pw: string) => measureStrength(pw, this.get().name, this.get().email)),
      tap((result) => {
        console.log(result);
        this.patchState({
          result,
          validating: false
        });
      })
    )
  );
}

bootstrapApplication(AppComponent);
