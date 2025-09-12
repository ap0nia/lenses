import { useForm } from 'react-hook-form';
import { type Lens, useLens } from '@hookform/lenses';
import { renderHook } from '@testing-library/react';
import { expectTypeOf } from 'vitest';

test('reflect can create a new lens', () => {
  const { result } = renderHook(() => {
    const form = useForm<{ a: string }>();
    const lens = useLens({ control: form.control });
    return lens;
  });

  expectTypeOf(result.current.reflect((l) => ({ b: l.a }))).toEqualTypeOf<Lens<{ b: string }>>();
});

test('spread operator is allowed for lenses in reflect', () => {
  const { result } = renderHook(() => {
    const form = useForm<{ a: string; b: { c: number } }>();
    const lens = useLens({ control: form.control });
    return lens;
  });

  expectTypeOf(
    result.current.reflect((l) => {
      expectTypeOf(l).toEqualTypeOf<{
        a: Lens<string>;
        b: Lens<{
          c: number;
        }>;
      }>();

      return { ...l };
    }),
  ).toEqualTypeOf<Lens<{ a: string; b: { c: number } }>>();
});

test('non lens fields cannot returned from reflect', () => {
  const { result } = renderHook(() => {
    const form = useForm<{ a: string }>();
    const lens = useLens({ control: form.control });
    return lens;
  });

  assertType(result.current.reflect((_, l) => ({ b: l.focus('a'), w: 'hello' })));
});

test('reflect can add props from another lens', () => {
  const { result: form1 } = renderHook(() => {
    const form = useForm<{ a: string }>();
    const lens = useLens({ control: form.control });
    return lens;
  });

  const { result: form2 } = renderHook(() => {
    const form = useForm<{ b: number }>();
    const lens = useLens({ control: form.control });
    return lens;
  });

  expectTypeOf(form1.current.reflect((l) => ({ c: l.a, d: form2.current.focus('b') }))).toEqualTypeOf<Lens<{ c: string; d: number }>>();
});

test('reflect return an object contains Date, File, FileList', () => {
  const { result } = renderHook(() => {
    const form = useForm<{ date: Date; file: File; fileList: FileList }>();
    const lens = useLens({ control: form.control });
    return lens;
  });

  const reflectedLens = result.current.reflect((dic) => {
    expectTypeOf(dic.date).toEqualTypeOf<Lens<Date>>();
    expectTypeOf(dic.file).toEqualTypeOf<Lens<File>>();
    expectTypeOf(dic.fileList).toEqualTypeOf<Lens<FileList>>();

    return {
      date: dic.date,
      file: dic.file,
      fileList: dic.fileList,
    };
  });

  expectTypeOf(reflectedLens).toEqualTypeOf<
    Lens<{
      date: Date;
      file: File;
      fileList: FileList;
    }>
  >();
});

test('basic lens focus with dot notation works correctly', () => {
  const { result } = renderHook(() => {
    const form = useForm<{
      password: { password: string; passwordConfirm: string };
      usernameNest: { name: string };
    }>();
    const lens = useLens({ control: form.control });
    return lens;
  });

  const lens = result.current;

  expect(lens.focus('password.password').interop().name).toBe('password.password');
  expect(lens.focus('usernameNest.name').interop().name).toBe('usernameNest.name');
});

test('reflected lens with chained focus calls works correctly', () => {
  type Input = {
    name: string;
    password: {
      password: string;
      passwordConfirm: string;
    };
    usernameNest: {
      name: string;
    };
  };

  type DataLens = {
    userName: string;
    password: {
      password_base: string;
      password_confirm: string;
    };
    nest2: {
      names: {
        name: string;
      };
    };
  };

  const { result } = renderHook(() => {
    const form = useForm<Input>();
    const lens = useLens({ control: form.control });
    return lens;
  });

  const lens = result.current;

  const reflected: Lens<DataLens> = lens.reflect((dic, l) => ({
    userName: dic.name,
    password: lens.focus('password').reflect<DataLens['password']>((pas) => ({
      password_base: pas.password,
      password_confirm: pas.passwordConfirm,
    })),
    nest2: lens.reflect<DataLens['nest2']>(() => ({
      names: l.focus('usernameNest'),
    })),
  }));

  expect(reflected.focus('password').focus('password_base').interop().name).toBe('password.password');
  expect(reflected.focus('password').focus('password_confirm').interop().name).toBe('password.passwordConfirm');
  expect(reflected.focus('nest2').focus('names').focus('name').interop().name).toBe('usernameNest.name');
});

test('reflected lens with dot notation resolves correct paths', () => {
  type Input = {
    password: {
      password: string;
      passwordConfirm: string;
    };
    usernameNest: {
      name: string;
    };
  };

  type DataLens = {
    password: {
      password_base: string;
      password_confirm: string;
    };
    nest2: {
      names: {
        name: string;
      };
    };
  };

  const { result } = renderHook(() => {
    const form = useForm<Input>();
    const lens = useLens({ control: form.control });
    return lens;
  });

  const lens = result.current;

  const reflected: Lens<DataLens> = lens.reflect((_, l) => ({
    password: lens.focus('password').reflect<DataLens['password']>((pas) => ({
      password_base: pas.password,
      password_confirm: pas.passwordConfirm,
    })),
    nest2: lens.reflect<DataLens['nest2']>(() => ({
      names: l.focus('usernameNest'),
    })),
  }));

  expect(reflected.focus('password.password_base').interop().name).toBe('password.password');
  expect(reflected.focus('password.password_confirm').interop().name).toBe('password.passwordConfirm');
  expect(reflected.focus('nest2.names.name').interop().name).toBe('usernameNest.name');
});

test('reflected lens handles duplicate key names in different nesting levels', () => {
  type Input = {
    id: string;
    nest: {
      id: string;
    };
  };

  const { result } = renderHook(() => {
    const form = useForm<Input>();
    const lens = useLens({ control: form.control });
    return lens;
  });

  const lens = result.current;

  const reflectedWithDuplicateKeys = lens.reflect((_, l) => ({
    id: l.focus('id'),
    nest_id: l.focus('nest').focus('id'),
  }));

  expect(reflectedWithDuplicateKeys.focus('nest_id').interop().name).toBe('nest.id');
});

test('reflected lens with nested objects resolves correct paths', () => {
  type Input = {
    password: {
      password: string;
      passwordConfirm: string;
    };
    usernameNest: {
      name: string;
    };
  };

  type DataLens = {
    password: {
      password_base: string;
      password_confirm: string;
    };
    nest2: {
      names: {
        name: string;
      };
    };
  };

  const { result } = renderHook(() => {
    const form = useForm<Input>();
    const lens = useLens({ control: form.control });
    return lens;
  });

  const lens = result.current;

  const reflected: Lens<DataLens> = lens.reflect((_, l) => ({
    password: {
      password_base: l.focus('password.password'),
      password_confirm: l.focus('password.passwordConfirm'),
    },
    nest2: {
      names: l.focus('usernameNest'),
    },
  }));

  expect(reflected.focus('password.password_base').interop().name).toBe('password.password');
  expect(reflected.focus('password.password_confirm').interop().name).toBe('password.passwordConfirm');
  expect(reflected.focus('nest2.names.name').interop().name).toBe('usernameNest.name');
});

test.skip('reflected lens with deeply nested objects resolves correct paths', () => {
  const { result } = renderHook(() => {
    const form = useForm<Input>();
    const lens = useLens(form);
    return lens;
  });

  const lens = result.current;

  type Input = {
    a: {
      b: {
        d: string;
      };
    };
    x: {
      y: string;
    };
  };

  type Output = {
    a: {
      b: {
        c: string;
      };
    };
    x: {
      y: {
        z: string;
      };
    };
  };

  const reflected: Lens<Output> = lens.reflect((_, l) => ({
    a: {
      b: {
        c: l.focus('a.b.d'),
      },
    },
    x: {
      y: {
        z: l.focus('x.y'),
      },
    },
  }));

  expect(reflected.focus('a.b.c').interop().name).toBe('a.b.a.b.d');
  expect(reflected.focus('x.y.z').interop().name).toBe('x.y.x.y');
});

test.skip('only adjusts lens path nested within object once', () => {
  type Input = {
    password: {
      password: string;
      passwordConfirm: string;
    };
    usernameNest: {
      name: string;
    };
  };

  type DataLens = {
    password: {
      password_base: string;
      password_confirm: string;
    };
    nest2: {
      names: {
        name: string;
      };
    };
  };

  const { result } = renderHook(() => {
    const form = useForm<Input>();
    const lens = useLens({ control: form.control });
    return lens;
  });

  const lens = result.current;

  const reflected: Lens<DataLens> = lens.reflect((_, l) => ({
    password: {
      password_base: l.focus('password.password'),
      password_confirm: l.focus('password.passwordConfirm'),
    },
    nest2: {
      names: l.focus('usernameNest'),
    },
  }));

  // The point of a boolean property within a lens is to prevent its path from being updated
  // outside of interop.

  reflected.focus('password.password_base');
  reflected.focus('password.password_confirm');

  expect(reflected.focus('password.password_base').interop().name).toBe('password.password.password');
  expect(reflected.focus('password.password_confirm').interop().name).toBe('password.password.passwordConfirm');
  expect(reflected.focus('nest2.names.name').interop().name).toBe('nest2.usernameNest.name');
});

test.skip('incorrectly appends path multiple times if boolean flag is wrong', () => {
  type Input = {
    password: {
      password: string;
      passwordConfirm: string;
    };
    usernameNest: {
      name: string;
    };
  };

  type DataLens = {
    password: {
      password_base: string;
      password_confirm: string;
    };
    nest2: {
      names: {
        name: string;
      };
    };
  };

  const { result } = renderHook(() => {
    const form = useForm<Input>();
    const lens = useLens({ control: form.control });
    return lens;
  });

  const lens = result.current;

  const reflected: Lens<DataLens> = lens.reflect((_, l) => ({
    password: {
      password_base: l.focus('password.password'),
      password_confirm: l.focus('password.passwordConfirm'),
    },
    nest2: {
      names: l.focus('usernameNest'),
    },
  }));

  // The point of a boolean property within a lens is to prevent its path from being updated
  // outside of interop.

  const a = reflected.focus('password.password_base');
  const b = reflected.focus('password.password_confirm');
  const c = reflected.focus('nest2.names');

  // @ts-expect-error Internal API.
  a.overridden = false;

  // @ts-expect-error Internal API.
  b.overridden = false;

  // @ts-expect-error Internal API.
  c.overridden = false;

  reflected.focus('password.password_base');
  reflected.focus('password.password_confirm');
  reflected.focus('nest2.names');

  // Since the boolean flag was forcefully unset, the proxy will re-append the path to the beginning.
  // This will make the paths wrong. Therefore, the boolean flag is required to de-dupe this operation.

  expect(reflected.focus('password.password_base').interop().name).not.toBe('password.password.password');
  expect(reflected.focus('password.password_confirm').interop().name).not.toBe('password.password.passwordConfirm');
  expect(reflected.focus('nest2.names.name').interop().name).not.toBe('nest2.usernameNest.name');

  // Wrongly generated names.

  expect(reflected.focus('password.password_base').interop().name).toBe('password.password.password.password');
  expect(reflected.focus('password.password_confirm').interop().name).toBe('password.password.password.passwordConfirm');
  expect(reflected.focus('nest2.names.name').interop().name).toBe('nest2.nest2.usernameNest.name');
});
